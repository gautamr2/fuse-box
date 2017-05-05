import { File } from "../core/File";
import { WorkFlowContext } from "../core/WorkflowContext";
import { Plugin } from "../core/WorkflowContext";

export interface VuePluginOptions {

}

let vueCompiler;
let vueTranspiler;
export class VuePluginClass implements Plugin {
    public test: RegExp = /\.vue$/;

    constructor(public options: VuePluginOptions = {}) { }

    public init(context: WorkFlowContext) {
        context.allowExtension(".vue");
    }

    public transform(file: File) {
        // caching ...
        const context = file.context;
        if (context.useCache) {
            let cached = context.cache.getStaticCache(file);
            if (cached) {
                file.isLoaded = true;
                if (cached.sourceMap) {
                    file.sourceMap = cached.sourceMap;
                }
                file.analysis.skip();
                file.analysis.dependencies = cached.dependencies;
                file.contents = cached.contents;

                return;
            }
        }

        file.loadContents();

        if (!vueCompiler) {
            vueCompiler = require("vue-template-compiler");
            vueTranspiler = require("vue-template-es2015-compiler");
        }

        let result = vueCompiler.parseComponent(file.contents, this.options);
        if (result.template && result.template.type === "template") {
            let html = result.template.content;
            let compiled = vueCompiler.compile(html);

            let jsContent = result.script.content;
            const ts = require("typescript");

            const jsTranspiled = ts.transpileModule(jsContent, file.context.getTypeScriptConfig());
            const tsResult = `var _p = {};
var _v = function(exports){${jsTranspiled.outputText}};
_p.render = ` + toFunction(compiled.render) + `
_p.staticRenderFns = [ ` + compiled.staticRenderFns.map(toFunction).join(',')  + ` ];
var _e = {}; _v(_e); _p = Object.assign(_e.default, _p)
module.exports =_p
            `;
            file.contents = tsResult;
            file.analysis.parseUsingAcorn();
            file.analysis.analyze();

            if (context.useCache) {
                context.emitJavascriptHotReload(file);
                context.cache.writeStaticCache(file, file.sourceMap);
            }
        }
    }
};

function toFunction (code) {
  return vueTranspiler('function render () {' + code + '}')
}

export const VuePlugin = (options?: VuePluginOptions) => {
    return new VuePluginClass(options);
};
