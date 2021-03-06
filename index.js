'use strict';

var fs = require('fs');
var path = require('path');

var hljs = require('highlightjs/highlight.pack.js');
var hlpath = require.resolve('highlightjs/highlight.pack.js').replace('highlight.pack.js','');

var md = require('markdown-it')({linkify: true, html: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="highlight '+lang+'"><code>' +
               hljs.highlight(lang, str, true).value +
               '</code></pre>';
      } catch (__) {}
    }

    return '<pre class="highlight"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
});
var yaml = require('js-yaml');
var ejs = require('ejs');
var uglify = require('uglify-js');

var globalOptions = {};

function javascript_include_tag(include) {
    var includeStr = fs.readFileSync(path.join(__dirname,'/source/javascripts/'+include+'.inc'),'utf8');
	if (globalOptions.minify) {
		var scripts = [];
		var includes = includeStr.split('\r').join().split('\n');
		for (var i in includes) {
			var inc = includes[i];
			var elements = inc.split('"');
			if (elements[1]) {
				scripts.push(path.join(__dirname,elements[1]));
			}
		}
		var bundle = uglify.minify(scripts);
		fs.writeFileSync(path.join(__dirname,'/pub/js/shins.js'),bundle.code,'utf8');
		includeStr = fs.readFileSync(path.join(__dirname,'/source/javascripts/'+include+'.bundle.inc'),'utf8');
	}
    return includeStr;
}

function partial(include) {
    var includeStr = fs.readFileSync(path.join(__dirname,'/source/includes/_'+include+'.md'),'utf8');
    return md.render(includeStr);
}

function stylesheet_link_tag(stylesheet,media) {
    if (media == 'screen') {
        var target = path.join(__dirname,'/pub/css/'+stylesheet+'.css');
        if (!fs.existsSync(target)) {
            var source = path.join(hlpath,'/styles/'+stylesheet+'.css');
            fs.writeFileSync(target, fs.readFileSync(source));
        }
    }
    return '<link rel="stylesheet" media="'+media+'" href="/pub/css/'+stylesheet+'.css">';
};

function language_array(language_tabs) {
    var result = [];
    for (var lang in language_tabs) {
        if (typeof language_tabs[lang] === 'object') {
            result.push(Object.keys(language_tabs[lang])[0]);
        }
        else {
            result.push(language_tabs[lang])
        }
    }
    return JSON.stringify(result).split('"').join('&quot;');
}

function postProcess(content){
    content = content.replace(/\<(h[123456])\>(.*)\<\/h[123456]\>/g,function(match,group1,group2){
       return '<'+group1+' id="'+group2.toLowerCase().split(' ').join('-').split('/').join('-')+'">'+group2+'</'+group1+'>';
    });
    return content;
}

function render(inputStr,options,callback) {

	if (typeof callback === 'undefined') { // for pre-v1.4.0 compatibility
		callback = options;
		options = {};
	}
	globalOptions = options;

    inputStr = inputStr.split('\r\n').join('\n');
    var inputArr = ('\n'+inputStr).split('\n---\n');
    var headerStr = inputArr[1];
    var header = yaml.safeLoad(headerStr);

    /* non-matching languages between Ruby Rouge and highlight.js at 2016/07/10 are
    ['ceylon','common_lisp','conf','cowscript','erb','factor','io','json-doc','liquid','literate_coffeescript','literate_haskell','llvm','make',
    'objective_c','plaintext','praat','properties','racket','sass','sed','shell','slim','sml','toml','tulip','viml'];*/
    var sh = hljs.getLanguage('bash');
    hljs.registerLanguage('shell',function(hljs){return sh;});
    hljs.registerLanguage('sh',function(hljs){return sh;});

    var content = md.render(inputArr[2]);
    content = postProcess(content);

    var locals = {};
    locals.current_page = {};
    locals.current_page.data = header;
    locals.yield = function() { return content; };
    locals.partial = partial;
    locals.image_tag = function(image) { return '<img src="/source/images/'+image+'">'; };
    locals.stylesheet_link_tag = stylesheet_link_tag;
    locals.javascript_include_tag = javascript_include_tag;
    locals.language_array = language_array;

    var ejsOptions = {};
    ejsOptions.debug = false;
    ejs.renderFile(path.join(__dirname,'/source/layouts/layout.ejs'), locals, ejsOptions, function(err, str){
        callback(err,str);
    });
}

module.exports = {
  render : render,
  srcDir : function() { return __dirname; }
};

