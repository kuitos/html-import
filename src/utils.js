/**
 * @author Kuitos
 * @homepage https://github.com/kuitos/
 * @since 2019-02-25
 * fork from https://github.com/systemjs/systemjs/blob/master/src/extras/global.js
 */

const isIE = navigator.userAgent.indexOf('Trident') !== -1;

// safari unpredictably lists some new globals first or second in object order
let firstGlobalProp, secondGlobalProp, lastGlobalProp;

export function getGlobalProp(global) {
	let cnt = 0;
	let lastProp;
	let hasIframe = false;

	// use Object.keys to make it trigger the trap if global is proxy
	const props = Object.keys(global);
	for (let i = 0; i < props.length; i++) {
		const p = props[i];
		// do not check frames cause it could be removed during import
		if (
			!global.hasOwnProperty(p) ||
			(!isNaN(p) && p < global.length) ||
			(isIE && global[p] && global[p].parent === window)
		)
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
	firstGlobalProp = secondGlobalProp = undefined;

	// use Object.keys to make it trigger the trap if global is proxy
	const props = Object.keys(global);
	for (let i = 0; i < props.length; i++) {
		const p = props[i];
		// do not check frames cause it could be removed during import
		if (
			!global.hasOwnProperty(p) ||
			(!isNaN(p) && p < global.length) ||
			(isIE && global[p] && global[p].parent === window)
		)
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

export function defaultGetPublicPath(url) {
	try {
		// URL 构造函数不支持使用 // 前缀的 url
		const { origin, pathname } = new URL(url.startsWith('//') ? `${location.protocol}${url}` : url, location.href);
		const paths = pathname.split('/');
		// 移除最后一个元素
		paths.pop();
		return `${origin}${paths.join('/')}/`;
	} catch (e) {
		console.warn(e);
		return '';
	}
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
