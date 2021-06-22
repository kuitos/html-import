/**
 * @author Kuitos
 * @homepage https://github.com/kuitos/
 * @since 2018-08-15 11:37
 */

import processTpl, { genLinkReplaceSymbol, genScriptReplaceSymbol, processCssContent } from './process-tpl';
import {
	defaultGetPublicPath,
	getGlobalProp,
	getInlineCode,
	noteGlobalProps,
	readResAsString,
	requestIdleCallback,
} from './utils';

const styleCache = {};
const scriptCache = {};
const embedHTMLCache = {};
if (!window.fetch) {
	throw new Error('[import-html-entry] Here is no "fetch" on the window env, you need to polyfill it');
}
const defaultFetch = window.fetch.bind(window);

function defaultGetTemplate(tpl) {
	return tpl;
}

/**
 * convert external css link to inline style for performance optimization
 * @param template
 * @param styles
 * @param opts
 * @return embedHTML
 */
function getEmbedHTML(template, styles, opts = {}) {
	const { fetch = defaultFetch } = opts;
	let embedHTML = template;

	return getExternalStyleSheets(styles, fetch)
		.then(styleSheets => {
			embedHTML = styles.reduce((html, styleSrc, i) => {
				const styleText = processCssContent(styleSrc, styleSheets[i]);
				html = html.replace(genLinkReplaceSymbol(styleSrc), `<style>/* ${styleSrc} */${styleText}</style>`);
				return html;
			}, embedHTML);
			return embedHTML;
		});
}

const isInlineCode = code => code.startsWith('<');

function getExecutableScript(scriptSrc, scriptText, proxy, strictGlobal) {
	const sourceUrl = isInlineCode(scriptSrc) ? '' : `//# sourceURL=${scriptSrc}\n`;

	// 通过这种方式获取全局 window，因为 script 也是在全局作用域下运行的，所以我们通过 window.proxy 绑定时也必须确保绑定到全局 window 上
	// 否则在嵌套场景下， window.proxy 设置的是内层应用的 window，而代码其实是在全局作用域运行的，会导致闭包里的 window.proxy 取的是最外层的微应用的 proxy
	const globalWindow = (0, eval)('window');
	globalWindow.proxy = proxy;
	// TODO 通过 strictGlobal 方式切换 with 闭包，待 with 方式坑趟平后再合并
	return strictGlobal
		? `;(function(window, self, globalThis){with(window){;${scriptText}\n${sourceUrl}}}).bind(window.proxy)(window.proxy, window.proxy, window.proxy);`
		: `;(function(window, self, globalThis){;${scriptText}\n${sourceUrl}}).bind(window.proxy)(window.proxy, window.proxy, window.proxy);`;
}

// for prefetch
export function getExternalStyleSheets(styles, fetch = defaultFetch) {
	return Promise.all(styles.map(styleLink => {
			if (isInlineCode(styleLink)) {
				// if it is inline style
				return getInlineCode(styleLink);
			} else {
				// external styles
				return styleCache[styleLink] ||
					(styleCache[styleLink] = fetch(styleLink).then(response => response.text()));
			}

		},
	));
}

// for prefetch
export function getExternalScripts(scripts, fetch = defaultFetch, errorCallback = () => {
}) {

	const fetchScript = scriptUrl => scriptCache[scriptUrl] ||
		(scriptCache[scriptUrl] = fetch(scriptUrl).then(response => {
			// usually browser treats 4xx and 5xx response of script loading as an error and will fire a script error event
			// https://stackoverflow.com/questions/5625420/what-http-headers-responses-trigger-the-onerror-handler-on-a-script-tag/5625603
			if (response.status >= 400) {
				errorCallback();
				throw new Error(`${scriptUrl} load failed with status ${response.status}`);
			}

			return response.text();
		}).catch(e => {
			errorCallback();
			throw e;
		}));

	return Promise.all(scripts.map(script => {

			if (typeof script === 'string') {
				if (isInlineCode(script)) {
					// if it is inline script
					return getInlineCode(script);
				} else {
					// external script
					return fetchScript(script);
				}
			} else {
				// use idle time to load async script
				const { src, async } = script;
				if (async) {
					return {
						src,
						async: true,
						content: new Promise((resolve, reject) => requestIdleCallback(() => fetchScript(src).then(resolve, reject))),
					};
				}

				return fetchScript(src);
			}
		},
	));
}

function throwNonBlockingError(error, msg) {
	setTimeout(() => {
		console.error(msg);
		throw error;
	});
}

const supportsUserTiming =
	typeof performance !== 'undefined' &&
	typeof performance.mark === 'function' &&
	typeof performance.clearMarks === 'function' &&
	typeof performance.measure === 'function' &&
	typeof performance.clearMeasures === 'function';

/**
 * FIXME to consistent with browser behavior, we should only provide callback way to invoke success and error event
 * @param entry
 * @param scripts
 * @param proxy
 * @param opts
 * @returns {Promise<unknown>}
 */
export function execScripts(entry, scripts, proxy = window, opts = {}) {
	const {
		fetch = defaultFetch, strictGlobal = false, success, error = () => {
		}, beforeExec = () => {
		}, afterExec = () => {
		},
	} = opts;

	return getExternalScripts(scripts, fetch, error)
		.then(scriptsText => {

			const geval = (scriptSrc, inlineScript) => {
				const rawCode = beforeExec(inlineScript, scriptSrc) || inlineScript;
				const code = getExecutableScript(scriptSrc, rawCode, proxy, strictGlobal);

				(0, eval)(code);

				afterExec(inlineScript, scriptSrc);
			};

			function exec(scriptSrc, inlineScript, resolve) {

				const markName = `Evaluating script ${scriptSrc}`;
				const measureName = `Evaluating Time Consuming: ${scriptSrc}`;

				if (process.env.NODE_ENV === 'development' && supportsUserTiming) {
					performance.mark(markName);
				}

				if (scriptSrc === entry) {
					noteGlobalProps(strictGlobal ? proxy : window);

					try {
						// bind window.proxy to change `this` reference in script
						geval(scriptSrc, inlineScript);
						const exports = proxy[getGlobalProp(strictGlobal ? proxy : window)] || {};
						resolve(exports);
					} catch (e) {
						// entry error must be thrown to make the promise settled
						console.error(`[import-html-entry]: error occurs while executing entry script ${scriptSrc}`);
						throw e;
					}
				} else {
					if (typeof inlineScript === 'string') {
						try {
							// bind window.proxy to change `this` reference in script
							geval(scriptSrc, inlineScript);
						} catch (e) {
							// consistent with browser behavior, any independent script evaluation error should not block the others
							throwNonBlockingError(e, `[import-html-entry]: error occurs while executing normal script ${scriptSrc}`);
						}
					} else {
						// external script marked with async
						inlineScript.async && inlineScript?.content
							.then(downloadedScriptText => geval(inlineScript.src, downloadedScriptText))
							.catch(e => {
								throwNonBlockingError(e, `[import-html-entry]: error occurs while executing async script ${inlineScript.src}`);
							});
					}
				}

				if (process.env.NODE_ENV === 'development' && supportsUserTiming) {
					performance.measure(measureName, markName);
					performance.clearMarks(markName);
					performance.clearMeasures(measureName);
				}
			}

			function schedule(i, resolvePromise) {

				if (i < scripts.length) {
					const scriptSrc = scripts[i];
					const inlineScript = scriptsText[i];

					exec(scriptSrc, inlineScript, resolvePromise);
					// resolve the promise while the last script executed and entry not provided
					if (!entry && i === scripts.length - 1) {
						resolvePromise();
					} else {
						schedule(i + 1, resolvePromise);
					}
				}
			}

			return new Promise(resolve => schedule(0, success || resolve));
		});
}

export default function importHTML(url, opts = {}) {
	let fetch = defaultFetch;
	let autoDecodeResponse = false;
	let getPublicPath = defaultGetPublicPath;
	let getTemplate = defaultGetTemplate;

	// compatible with the legacy importHTML api
	if (typeof opts === 'function') {
		fetch = opts;
	} else {
		// fetch option is availble
		if (opts.fetch) {
			// fetch is a funciton
			if (typeof opts.fetch === 'function') {
				fetch = opts.fetch;
			} else { // configuration
				fetch = opts.fetch.fn || defaultFetch;
				autoDecodeResponse = !!opts.fetch.autoDecodeResponse;
			}
		}
		getPublicPath = opts.getPublicPath || opts.getDomain || defaultGetPublicPath;
		getTemplate = opts.getTemplate || defaultGetTemplate;
	}

	return embedHTMLCache[url] || (embedHTMLCache[url] = fetch(url)
		.then(response => readResAsString(response, autoDecodeResponse))
		.then(html => {

			const assetPublicPath = getPublicPath(url);
			const { template, scripts, entry, styles } = processTpl(getTemplate(html), assetPublicPath);

			return getEmbedHTML(template, styles, { fetch }).then(embedHTML => ({
				template: embedHTML,
				assetPublicPath,
				getExternalScripts: () => getExternalScripts(scripts, fetch),
				getExternalStyleSheets: () => getExternalStyleSheets(styles, fetch),
				execScripts: (proxy, strictGlobal, execScriptsHooks = {}) => {
					if (!scripts.length) {
						return Promise.resolve();
					}
					return execScripts(entry, scripts, proxy, {
						fetch,
						strictGlobal,
						beforeExec: execScriptsHooks.beforeExec,
						afterExec: execScriptsHooks.afterExec,
					});
				},
			}));
		}));
}

export function importEntry(entry, opts = {}) {
	const { fetch = defaultFetch, getTemplate = defaultGetTemplate } = opts;
	const getPublicPath = opts.getPublicPath || opts.getDomain || defaultGetPublicPath;

	if (!entry) {
		throw new SyntaxError('entry should not be empty!');
	}

	// html entry
	if (typeof entry === 'string') {
		return importHTML(entry, {
			fetch,
			getPublicPath,
			getTemplate,
		});
	}

	// config entry
	if (Array.isArray(entry.scripts) || Array.isArray(entry.styles)) {

		const { scripts = [], styles = [], html = '' } = entry;
		const getHTMLWithStylePlaceholder = tpl => styles.reduceRight((html, styleSrc) => `${genLinkReplaceSymbol(styleSrc)}${html}`, tpl);
		const getHTMLWithScriptPlaceholder = tpl => scripts.reduce((html, scriptSrc) => `${html}${genScriptReplaceSymbol(scriptSrc)}`, tpl);

		return getEmbedHTML(getTemplate(getHTMLWithScriptPlaceholder(getHTMLWithStylePlaceholder(html))), styles, { fetch }).then(embedHTML => ({
			template: embedHTML,
			assetPublicPath: getPublicPath(entry),
			getExternalScripts: () => getExternalScripts(scripts, fetch),
			getExternalStyleSheets: () => getExternalStyleSheets(styles, fetch),
			execScripts: (proxy, strictGlobal, execScriptsHooks = {}) => {
				if (!scripts.length) {
					return Promise.resolve();
				}
				return execScripts(scripts[scripts.length - 1], scripts, proxy, {
					fetch,
					strictGlobal,
					beforeExec: execScriptsHooks.beforeExec,
					afterExec: execScriptsHooks.afterExec,
				});
			},
		}));

	} else {
		throw new SyntaxError('entry scripts or styles should be array!');
	}
}
