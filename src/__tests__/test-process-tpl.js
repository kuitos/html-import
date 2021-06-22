import { readFileSync } from 'fs';
import processTpl, {
	genIgnoreAssetReplaceSymbol,
	genLinkReplaceSymbol,
	genModuleScriptReplaceSymbol,
	genScriptReplaceSymbol,
	processCssContent,
} from '../process-tpl';

test('test process-tpl', () => {

	const tpl = '<!DOCTYPE html><html><head>\n' +
		'\n' +
		'<link rel="shortcut icon" href="https://t.alipayobjects.com/images/rmsweb/T1pqpiXfJgXXXXXXXX.png" type="image/x-icon">\n' +
		'<link rel="preload" href="//gw.alipayobjects.com/as/g/antcloud-fe/antd-cloud-nav/0.2.22/antd-cloud-nav.min.js">\n' +
		'<link rel="prefetch" href="/a3-ie6-polyfill.js">\n' +
		'<link rel="stylesheet" href="/umi.css">\n' +
		'<link rel="preload" as="font" href="/static/fonts/iconfont.woff" type="font/woff" crossorigin="anonymous">\n' +
		'\n' +
		'<meta charset="utf-8">\n' +
		'<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no">\n' +
		'<title>&#x91D1;&#x878D;&#x4E91;&#x63A7;&#x5236;&#x53F0;</title>\n' +
		'<script data-test>\n' +
		'  window.routerBase = "/";\n' +
		'</script>\n' +
		'<script \n ' +
		'data-test>\n' +
		'  window.routerBase = "/";\n' +
		'</script>\n' +
		'<script>\n' +
		'\n' +
		'// umi version: 2.2.8\n' +
		'// build time: Wed Dec 26 2018 17:54:47 GMT+0800 (CST)\n' +
		'\n' +
		'</script>\n' +
		'<script src="//gw.alipayobjects.com/as/g/antcloud-fe/antd-cloud-nav/0.2.22/antd-cloud-nav.min.js"></script>\n' +
		'<script \n' +
		'  src="https://gw.alipayobjects.com/os/lib/react/16.8.6/umd/react.production.min.js"\n' +
		'  crossorigin="anonymous"' +
		'></script>' +
		'<script \n' +
		'  src="/main-es2015.js"\n' +
		'  type="module"' +
		'></script>' +
		'<script \n' +
		'  src="/main-es5.js"\n' +
		'  nomodule' +
		'></script>' +
		'<script src="/test-type.json" type="test"></script>' +
		'<script type=systemjs-importmap>{"a": 1}</script>' +
		'<script \n' +
		'  src="/test-async.js"\n' +
		'  async' +
		'></script>' +
		'<style>\n' +
		'body {\n' +
		'background-color: red;\n' +
		'}\n' +
		'</style>\n' +
		'</head>\n' +
		'<body>\n' +
		'\n' +
		'<div id="root"></div>\n' +
		'\n' +
		'<script src="/umi.js"></script>\n' +
		'<!-- <script src="/a1.js"></script>' +
		'-->' +
		'<script src="/comment.js"></script>\n' +
		'<!-- <script src="/a2.js"></script>\n' +
		'-->' +
		'<!--[if IE 6]>\n' +
		'<!-- <script src="/a3-ie6-polyfill.js"></script>\n' +
		'<![endif]-->' +
		'\n' +
		'\n' +
		'</body></html>';

	const { entry, scripts, template } = processTpl(tpl, 'http://kuitos.me');
	expect(entry).toBe('http://kuitos.me/comment.js');
	expect(scripts).toEqual([
		'<script data-test>\n  window.routerBase = "/";\n</script>',
		'<script \n data-test>\n  window.routerBase = "/";\n</script>',
		'//gw.alipayobjects.com/as/g/antcloud-fe/antd-cloud-nav/0.2.22/antd-cloud-nav.min.js',
		'https://gw.alipayobjects.com/os/lib/react/16.8.6/umd/react.production.min.js',
		// Jest/jsdom doesn't support module scripts, so nomodule scripts will be imported in test cases.
		// https://github.com/jsdom/jsdom/issues/2475
		'http://kuitos.me/main-es5.js',
		{
			async: true,
			src: 'http://kuitos.me/test-async.js',
		},
		'http://kuitos.me/umi.js',
		'http://kuitos.me/comment.js']);
	expect(template.indexOf(genScriptReplaceSymbol('http://kuitos.me/test-async.js', true)) !== -1).toBeTruthy();
	expect(template.indexOf(genLinkReplaceSymbol('http://kuitos.me/umi.css')) !== -1).toBeTruthy();
	expect(template.indexOf(genScriptReplaceSymbol('http://kuitos.me/umi.js')) !== -1).toBeTruthy();
	expect(template.indexOf(genScriptReplaceSymbol('http://kuitos.me/comment.js')) !== -1).toBeTruthy();
	expect(template.indexOf(genScriptReplaceSymbol('http://kuitos.me/main-es5.js')) !== -1).toBeTruthy();
	expect(template.indexOf('<script src="/test-type.json" type="test"></script>') !== -1).toBeTruthy();
	expect(template.indexOf('<script type=systemjs-importmap>{"a": 1}</script>') !== -1).toBeTruthy();

	// link as font 资源直接被 ignore
	expect(template.indexOf('<link rel="preload" as="font" href="/static/fonts/iconfont.woff" type="font/woff" crossorigin="anonymous">') !== -1).toBeTruthy();
	// preload 资源直接被 ignore
	expect(template.indexOf('<link rel="preload" href="//gw.alipayobjects.com/as/g/antcloud-fe/antd-cloud-nav/0.2.22/antd-cloud-nav.min.js">') === -1).toBeTruthy();
	// prefetch/preload 会被 replace
	expect(template.indexOf(genLinkReplaceSymbol('/a3-ie6-polyfill.js', true)) !== -1).toBeTruthy();
	// prefetch 资源直接被 ignore
	expect(template.indexOf('<link rel="prefetch" href="/a3-ie6-polyfill.js">') === -1).toBeTruthy();
	// type="module" 资源被 ignore
	expect(template.indexOf(genModuleScriptReplaceSymbol('/main-es2015.js', false)) === -1).toBeTruthy();

	const { styles, template: template2 } = processTpl(tpl, 'http://kuitos.me/cdn/');
	expect(styles[0]).toBe('http://kuitos.me/umi.css');
	expect(template2.indexOf(genLinkReplaceSymbol('http://kuitos.me/umi.css')) !== -1).toBeTruthy();

});

test('test ignore js or css', () => {
	const tpl = readFileSync(require.resolve('./fixtures/ignore-js-css.html'), { encoding: 'utf-8' });

	const { entry, template } = processTpl(tpl, 'http://kuitos.me/cdn/');
	expect(entry).toBe('http://kuitos.me/cdn/app.js');

	expect(template.indexOf(genIgnoreAssetReplaceSymbol('style file')) !== -1).toBeTruthy();

	expect(template.indexOf(genLinkReplaceSymbol('http://kuitos.me/umi.css')) === -1).toBeTruthy();
	expect(template.indexOf(genIgnoreAssetReplaceSymbol('http://kuitos.me/umi.css')) !== -1).toBeTruthy();

	expect(template.indexOf(genScriptReplaceSymbol('//cdn.jsdelivr.net/npm/vue@2.6.10/dist/vue.js')) === -1).toBeTruthy();
	expect(template.indexOf(genScriptReplaceSymbol('http://kuitos.me/polyfill.js')) === -1).toBeTruthy();
	expect(template.indexOf(genIgnoreAssetReplaceSymbol('http://kuitos.me/polyfill.js')) !== -1).toBeTruthy();
	expect(template.indexOf(genIgnoreAssetReplaceSymbol('js file')) !== -1).toBeTruthy();
});

test('test resource with no quotation marks', () => {

	const tpl = '<!DOCTYPE html><html><head>\n' +
		'\n' +
		'<link rel="shortcut icon" href=https://t.alipayobjects.com/images/rmsweb/T1pqpiXfJgXXXXXXXX.png type="image/x-icon">\n' +
		'<link rel="preload" href=//gw.alipayobjects.com/as/g/antcloud-fe/antd-cloud-nav/0.2.22/antd-cloud-nav.min.js>\n' +
		'<link rel="prefetch" href=/a3-ie6-polyfill.js>\n' +
		'<link rel=stylesheet href=/umi.css>\n' +
		'\n' +
		'<meta charset="utf-8">\n' +
		'<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no">\n' +
		'<title>&#x91D1;&#x878D;&#x4E91;&#x63A7;&#x5236;&#x53F0;</title>\n' +
		'<script data-test>\n' +
		'  window.routerBase = "/";\n' +
		'</script>\n' +
		'<script \n ' +
		'data-test>\n' +
		'  window.routerBase = "/";\n' +
		'</script>\n' +
		'<script>\n' +
		'\n' +
		'// umi version: 2.2.8\n' +
		'// build time: Wed Dec 26 2018 17:54:47 GMT+0800 (CST)\n' +
		'\n' +
		'</script>\n' +
		'<script src=//gw.alipayobjects.com/as/g/antcloud-fe/antd-cloud-nav/0.2.22/antd-cloud-nav.min.js></script>\n' +
		'<script \n' +
		'  src=https://gw.alipayobjects.com/os/lib/react/16.8.6/umd/react.production.min.js\n' +
		'  crossorigin="anonymous"' +
		'></script>' +
		'<script \n' +
		'  src=/main-es2015.js\n' +
		'  type=module' +
		'></script>' +
		'<script \n' +
		'  src=/main-es5.js\n' +
		'  nomodule' +
		'></script>' +
		'<style>\n' +
		'body {\n' +
		'background-color: red;\n' +
		'}\n' +
		'</style>\n' +
		'</head>\n' +
		'<body>\n' +
		'\n' +
		'<div id="root"></div>\n' +
		'\n' +
		'<script src=/umi.js></script>\n' +
		'<!-- <script src=/a1.js></script>' +
		'-->' +
		'<script src=/comment.js></script>\n' +
		'<!-- <script src=/a2.js></script>\n' +
		'-->' +
		'<!--[if IE 6]>\n' +
		'<!-- <script src=/a3-ie6-polyfill.js></script>\n' +
		'<![endif]-->' +
		'\n' +
		'\n' +
		'</body></html>';

	const { entry, scripts, template } = processTpl(tpl, 'http://kuitos.me');
	expect(entry).toBe('http://kuitos.me/comment.js');
	expect(scripts).toEqual(['<script data-test>\n  window.routerBase = "/";\n</script>',
		'<script \n data-test>\n  window.routerBase = "/";\n</script>',
		'//gw.alipayobjects.com/as/g/antcloud-fe/antd-cloud-nav/0.2.22/antd-cloud-nav.min.js',
		'https://gw.alipayobjects.com/os/lib/react/16.8.6/umd/react.production.min.js',
		'http://kuitos.me/main-es5.js',
		'http://kuitos.me/umi.js',
		'http://kuitos.me/comment.js']);
	expect(template.indexOf(genLinkReplaceSymbol('http://kuitos.me/umi.css')) !== -1).toBeTruthy();
	expect(template.indexOf(genScriptReplaceSymbol('http://kuitos.me/umi.js')) !== -1).toBeTruthy();
	expect(template.indexOf(genScriptReplaceSymbol('http://kuitos.me/comment.js')) !== -1).toBeTruthy();
	expect(template.indexOf(genScriptReplaceSymbol('http://kuitos.me/main-es5.js')) !== -1).toBeTruthy();

	// preload 资源直接被忽略
	expect(template.indexOf('<link rel="preload" href=//gw.alipayobjects.com/as/g/antcloud-fe/antd-cloud-nav/0.2.22/antd-cloud-nav.min.js>') === -1).toBeTruthy();
	// preload/prefetch 资源被 replace
	expect(template.indexOf(genLinkReplaceSymbol('/a3-ie6-polyfill.js', true)) !== -1).toBeTruthy();
	expect(template.indexOf('<link rel="prefetch" href=http://kuitos.me/a3-ie6-polyfill.js>') === -1).toBeTruthy();
	// type="module" 资源被 ignore
	expect(template.indexOf(genModuleScriptReplaceSymbol('/main-es2015.js', false)) === -1).toBeTruthy();

	const { styles, template: template2 } = processTpl(tpl, 'http://kuitos.me/cdn');
	expect(styles[0]).toBe('http://kuitos.me/umi.css');
	expect(template2.indexOf(genLinkReplaceSymbol('http://kuitos.me/umi.css')) !== -1).toBeTruthy();

});

test('test resource mixing quotation marks', () => {

	const tpl = '<!DOCTYPE html><html><head>\n' +
		'\n' +
		'<link rel="shortcut icon" href=https://t.alipayobjects.com/images/rmsweb/T1pqpiXfJgXXXXXXXX.png type="image/x-icon">\n' +
		'<link rel="preload" href=//gw.alipayobjects.com/as/g/antcloud-fe/antd-cloud-nav/0.2.22/antd-cloud-nav.min.js>\n' +
		'<link rel="prefetch" href="/a3-ie6-polyfill.js">\n' +
		'<link rel=stylesheet href="/umi.css">\n' +
		'\n' +
		'<meta charset="utf-8">\n' +
		'<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no">\n' +
		'<title>&#x91D1;&#x878D;&#x4E91;&#x63A7;&#x5236;&#x53F0;</title>\n' +
		'<script data-test>\n' +
		'  window.routerBase = "/";\n' +
		'</script>\n' +
		'<script \n ' +
		'data-test>\n' +
		'  window.routerBase = "/";\n' +
		'</script>\n' +
		'<script>\n' +
		'\n' +
		'// umi version: 2.2.8\n' +
		'// build time: Wed Dec 26 2018 17:54:47 GMT+0800 (CST)\n' +
		'\n' +
		'</script>\n' +
		'<script src="//gw.alipayobjects.com/as/g/antcloud-fe/antd-cloud-nav/0.2.22/antd-cloud-nav.min.js"></script>\n' +
		'<script \n' +
		'  src=https://gw.alipayobjects.com/os/lib/react/16.8.6/umd/react.production.min.js\n' +
		'  crossorigin="anonymous"' +
		'></script>' +
		'<script \n' +
		'  src=/main-es2015.js\n' +
		'  type=\'module\'' +
		'></script>' +
		'<script \n' +
		'  src=\'/main-es5.js\'\n' +
		'  nomodule' +
		'></script>' +
		'<style>\n' +
		'body {\n' +
		'background-color: red;\n' +
		'}\n' +
		'</style>\n' +
		'</head>\n' +
		'<body>\n' +
		'\n' +
		'<div id="root"></div>\n' +
		'\n' +
		'<script src=./umi.js></script>\n' +
		'<!-- <script src=/a1.js></script>' +
		'-->' +
		'<script src="./comment.js"></script>\n' +
		'<!-- <script src=/a2.js></script>\n' +
		'-->' +
		'<!--[if IE 6]>\n' +
		'<!-- <script src=/a3-ie6-polyfill.js></script>\n' +
		'<![endif]-->' +
		'\n' +
		'\n' +
		'</body></html>';

	const { entry, scripts, template } = processTpl(tpl, 'http://kuitos.me');
	expect(entry).toBe('http://kuitos.me/comment.js');
	expect(scripts).toEqual(['<script data-test>\n  window.routerBase = "/";\n</script>',
		'<script \n data-test>\n  window.routerBase = "/";\n</script>',
		'//gw.alipayobjects.com/as/g/antcloud-fe/antd-cloud-nav/0.2.22/antd-cloud-nav.min.js',
		'https://gw.alipayobjects.com/os/lib/react/16.8.6/umd/react.production.min.js',
		'http://kuitos.me/main-es5.js',
		'http://kuitos.me/umi.js',
		'http://kuitos.me/comment.js']);
	expect(template.indexOf(genLinkReplaceSymbol('http://kuitos.me/umi.css')) !== -1).toBeTruthy();
	expect(template.indexOf(genScriptReplaceSymbol('http://kuitos.me/umi.js')) !== -1).toBeTruthy();
	expect(template.indexOf(genScriptReplaceSymbol('http://kuitos.me/comment.js')) !== -1).toBeTruthy();
	expect(template.indexOf(genScriptReplaceSymbol('http://kuitos.me/main-es5.js')) !== -1).toBeTruthy();

	// preload/prefetch 资源直接被 ignore
	expect(template.indexOf('<link rel="preload" href=//gw.alipayobjects.com/as/g/antcloud-fe/antd-cloud-nav/0.2.22/antd-cloud-nav.min.js>') === -1).toBeTruthy();
	// 相对路径的补全 host
	expect(template.indexOf(genLinkReplaceSymbol('/a3-ie6-polyfill.js', true)) === -1).toBeFalsy();
	expect(template.indexOf('<link rel="prefetch" href="/a3-ie6-polyfill.js">') === -1).toBeTruthy();
	// type="module" 资源被 ignore
	expect(template.indexOf(genModuleScriptReplaceSymbol('/main-es2015.js', false)) === -1).toBeTruthy();

	const { styles, template: template2 } = processTpl(tpl, 'http://kuitos.me/cdn');
	expect(styles[0]).toBe('http://kuitos.me/umi.css');
	expect(template2.indexOf(genLinkReplaceSymbol('http://kuitos.me/umi.css')) !== -1).toBeTruthy();

});

test('should work with huge html content', () => {
	const hugeHtmlContent = readFileSync(require.resolve('./fixtures/huge-content.html'), 'utf-8');

	const start = Date.now();
	processTpl(hugeHtmlContent, '//test.com');
	const during = Date.now() - start;
	expect(during < 1000).toBeTruthy();
});

test('test process url in external css resources', () => {
	const transformedStyleText = processCssContent('//cdntest.com/css/ui.css', `
		@import 'component1.css'
		@import url('component2.less')
		.test-notice {
			background: #ffffff url(../images/bg1.jpg) no-repeat center left;
			background-image: url( '../images/bg2.jpg' );
			background-image: url("../images/bg3.jpg");
			background-image: url("//test.com/images/bg4.jpg");
			background-image: url("http://test.com/images/bg5.jpg");
		};
		/*# sourceMappingURL=test-notice.css.map */
	`);
	expect(transformedStyleText.indexOf('//cdntest.com/css/component1.css') !== -1).toBeTruthy();
	expect(transformedStyleText.indexOf('//cdntest.com/css/component2.less') !== -1).toBeTruthy();
	expect(transformedStyleText.indexOf('//cdntest.com/images/bg1.jpg') !== -1).toBeTruthy();
	expect(transformedStyleText.indexOf('//cdntest.com/images/bg2.jpg') !== -1).toBeTruthy();
	expect(transformedStyleText.indexOf('//cdntest.com/images/bg3.jpg') !== -1).toBeTruthy();
	expect(transformedStyleText.indexOf('//test.com/images/bg4.jpg') !== -1).toBeTruthy();
	expect(transformedStyleText.indexOf('http://test.com/images/bg5.jpg') !== -1).toBeTruthy();
	expect(transformedStyleText.indexOf('//cdntest.com/css/test-notice.css.map') !== -1).toBeTruthy();
});