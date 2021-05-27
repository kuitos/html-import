/**
 * @author Kuitos
 * @homepage https://github.com/kuitos/
 * @since 2019-02-25
 * fork from https://github.com/systemjs/systemjs/blob/master/src/extras/global.js
 */

const isIE11 = typeof navigator !== 'undefined' && navigator.userAgent.indexOf('Trident') !== -1;

function shouldSkipProperty(global, p) {
	if (
		!global.hasOwnProperty(p) ||
		!isNaN(p) && p < global.length
	)
		return true;

	if (isIE11) {
		// https://github.com/kuitos/import-html-entry/pull/32，最小化 try 范围
		try {
			return global[p] && typeof window !== 'undefined' && global[p].parent === window;
		} catch (err) {
			return true;
		}
	} else {
		return false;
	}
}

// safari unpredictably lists some new globals first or second in object order
let firstGlobalProp, secondGlobalProp, lastGlobalProp;

export function getGlobalProp(global) {
	let cnt = 0;
	let lastProp;
	let hasIframe = false;

	for (let p in global) {
		if (shouldSkipProperty(global, p))
			continue;

		// 遍历 iframe，检查 window 上的属性值是否是 iframe，是则跳过后面的 first 和 second 判断
		for (let i = 0; i < window.frames.length && !hasIframe; i++) {
			const frame = window.frames[i];
			if (frame === global[p]) {
				hasIframe = true;
				break;
			}
		}

		if (!hasIframe && (cnt === 0 && p !== firstGlobalProp || cnt === 1 && p !== secondGlobalProp))
			return p;
		cnt++;
		lastProp = p;
	}

	if (lastProp !== lastGlobalProp)
		return lastProp;
}

export function noteGlobalProps(global) {
	// alternatively Object.keys(global).pop()
	// but this may be faster (pending benchmarks)
	firstGlobalProp = secondGlobalProp = undefined;

	for (let p in global) {
		if (shouldSkipProperty(global, p))
			continue;
		if (!firstGlobalProp)
			firstGlobalProp = p;
		else if (!secondGlobalProp)
			secondGlobalProp = p;
		lastGlobalProp = p;
	}

	return lastGlobalProp;
}

export function getInlineCode(match) {
	const start = match.indexOf('>') + 1;
	const end = match.lastIndexOf('<');
	return match.substring(start, end);
}

export function defaultGetPublicPath(entry) {
	if (typeof entry === 'object') {
		return '/';
	}
	try {
		// URL 构造函数不支持使用 // 前缀的 url
		const { origin, pathname } = new URL(entry.startsWith('//') ? `${location.protocol}${entry}` : entry, location.href);
		const paths = pathname.split('/');
		// 移除最后一个元素
		paths.pop();
		return `${origin}${paths.join('/')}/`;
	} catch (e) {
		console.warn(e);
		return '';
	}
}

// Detect whether browser supports `<script type=module>` or not
export function isModuleScriptSupported() {
	const s = document.createElement('script');
	return 'noModule' in s;
}

// RIC and shim for browsers setTimeout() without it
export const requestIdleCallback =
	window.requestIdleCallback ||
	function requestIdleCallback(cb) {
		const start = Date.now();
		return setTimeout(() => {
			cb({
				didTimeout: false,
				timeRemaining() {
					return Math.max(0, 50 - (Date.now() - start));
				},
			});
		}, 1);
	};

export function readResAsString(response, autoDetectCharset) {
	// 未启用自动检测
	if (!autoDetectCharset) {
		return response.text();
	}

	// 如果没headers，发生在test环境下的mock数据，为兼容原有测试用例
	if (!response.headers) {
		return response.text();
	}

	// 如果没返回content-type，走默认逻辑
	const contentType = response.headers.get('Content-Type');
	if (!contentType) {
		return response.text();
	}

	// 解析content-type内的charset
	// Content-Type: text/html; charset=utf-8
	// Content-Type: multipart/form-data; boundary=something
	// GET请求下不会出现第二种content-type
	let charset = 'utf-8';
	const parts = contentType.split(';');
	if (parts.length === 2) {
		const [, value] = parts[1].split('=');
		const encoding = value && value.trim();
		if (encoding) {
			charset = encoding;
		}
	}

	// 如果还是utf-8，那么走默认，兼容原有逻辑，这段代码删除也应该工作
	if (charset.toUpperCase() === 'UTF-8') {
		return response.text();
	}

	// 走流读取，编码可能是gbk，gb2312等，比如sofa 3默认是gbk编码
	return response.blob()
		.then(file => new Promise((resolve, reject) => {
			const reader = new window.FileReader();
			reader.onload = () => {
				resolve(reader.result);
			};
			reader.onerror = reject;
			reader.readAsText(file, charset);
		}));
}

const evalCache = {};

export function evalCode(scriptSrc, code) {
	const key = scriptSrc;
	if (!evalCache[key]) {
		const functionWrappedCode = `window.__TEMP_EVAL_FUNC__ = function(){${code}}`;
		(0, eval)(functionWrappedCode);
		evalCache[key] = window.__TEMP_EVAL_FUNC__;
		delete window.__TEMP_EVAL_FUNC__;
	}
	const evalFunc = evalCache[key];
	evalFunc.call(window);
}
