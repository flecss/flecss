const { readFileSync, existsSync, readdirSync, cpSync, statSync } = require("fs");
const { join, dirname, basename, normalize } = require("path");
const { EventEmitter } = require("events");

const sass = require("sass");
const CleanCSS = require("clean-css");

const _config = {
    flecssNamespaceIdentifier: "flecss",
    flecssVariablesIdentifier: "flecss:vars"
};


const ELibrary = {
    STANDALONE: "standalone",
    CORE: "flecss",
    EXTRA: "flecss.extra"
};

class Transpiler {
    static #sourceDirPath = join(__dirname, "../src");

    static #mergeOptions(targetOptions = {}, sourceOptions = {}) {
        if(Array.isArray(sourceOptions)) {
            return Array.isArray(targetOptions)
            ? Array.from(new Set([ ...targetOptions, ...sourceOptions ]))
            : sourceOptions;
        }

        const isKeyObject = (obj) => typeof(obj) === "object" && !!Object.entries(obj ?? {}).length;
		if(!isKeyObject(targetOptions)) return sourceOptions;

		targetOptions = !isKeyObject(targetOptions) ? {} : targetOptions;
		for(const key in sourceOptions) {
			if(sourceOptions[key] === undefined) continue;
            
			targetOptions[key] = isKeyObject(sourceOptions[key])
                ? Transpiler.#mergeOptions(targetOptions[key], sourceOptions[key])
                : sourceOptions[key];
		}
        
		return targetOptions;
    }

    #options;
    #overrideVars;
    
    constructor(options = {}) {
        this.#options = Transpiler.#mergeOptions({
            development: false,
            library: ELibrary.CORE
        }, options);

        if(!this.#options.variables) return;

        try {
            this.#overrideVars = (typeof(this.#options.variables) !== "string")
                ? Object.entries(this.#options.variables)
                    .filter(entry => /^\$?[\w\d_-]+$/.test(entry[0]))
                    .map(entry => [
                        entry[0].replace(/^\$?/, "$"), entry[1]
                    ].join(": "))
                    .join("\n")
                : this.#options.variables;
        } catch(err) {
            throw new AggregateError([ "Could not parse override variables", err ]);
        }
    }

    #getHelperModulePath(moduleName) {
        return join(Transpiler.#sourceDirPath,`${moduleName}.scss`);
    }

    fromString(scss, options = {}) {
        if(!Object.values(ELibrary).includes(this.#options.library))
            throw new ReferenceError(`Unknown library '${this.#options.library}'`);

        const scssSnippets = [
            scss
        ];
        const isStandalone = (this.#options.library === ELibrary.STANDALONE);
        !isStandalone
        && scssSnippets.unshift(`@forward "${join(Transpiler.#sourceDirPath, "./flecss.scss")}";`);
        
        const getSymbolicUrl = (id) => {
            return new URL(`file:///SYMBOLIC/${id}`);
        };  
        
        const sassResult = sass.compileString(
            scssSnippets.join("\n"),
            {
                loadPaths: [ ...(options.loadPaths ?? []), !isStandalone ? Transpiler.#sourceDirPath : [] ].flat(),
                style: this.#options.development
                    ? "expanded"
                    : "compressed",
                quietDeps: true,
                importers: [
                    {
                        load: (symbolicUrl) => {
                            let css;
                            switch(symbolicUrl.toString()) {
                                case getSymbolicUrl("util").toString():
                                    css = readFileSync(this.#getHelperModulePath("flecss.util")).toString();

                                    break;
                                case getSymbolicUrl("config").toString():
                                    prefix = this.#overrideVars;
                                    helperModuleName = "flecss.config";

                                    break;
                                default:
                                    return null;
                            }
                            
                            return {
                                contents: css,
                                syntax: "scss"
                            };
                        },
                        canonicalize: (reference) => {
                            if(isStandalone) return null;
                            
                            switch(reference) {
                                case _config.flecssNamespaceIdentifier:
                                    return getSymbolicUrl("util");
                                case _config.flecssVariablesIdentifier:
                                    return getSymbolicUrl("config");
                            }

                            return null;
                        }
                    }
                ]
            }
        );
        
        return {
            css: new CleanCSS({
                    inline: [ "remote "],
                    level: 1 + +!this.#options.development
                })
                .minify(sassResult.css)
                .styles,
            loadedUrls: sassResult.loadedUrls
        }
    }

    fromFile(path, options) {
        if(!existsSync(path)) {
            throw new ReferenceError(`Source file does not exist ${path}`);
        }
        if(statSync(path).isDirectory()
        || !/\.scss$/i.test(path)) {
            throw new SyntaxError(`Invalid source file (expects ${basename(path)}, expects *.scss`);
        }
        
        const optionsWithDefaults = Transpiler.#mergeOptions({
            loadPaths: [ dirname(path) ]
        }, options);

        return this.fromString(readFileSync(path).toString(), optionsWithDefaults);
    }

    watchFile(path, options) {
        if(!existsSync(path)) {
            throw new ReferenceError(`Source file does not exist ${path}`);
        }
        
        const absoluteDirPath = !statSync(path).isDirectory()
            ? dirname(path)
            : path;
        
        const dirents = readdirSync(
            absoluteDirPath,
            {
                recursive: true,
                withFileTypes: true
            }
        )
        .filter((dirent) => dirent.isFile())
        .filter((dirent) => /\.scss/i.test(dirent.name));
            
        const optionsWithDefaults = Transpiler.#mergeOptions({
            watch: false,
            modToleranceMs: 1000
        }, options);
        
        const emitter = new EventEmitter();

        let i = 0;
        const tryTranspile = (force = false) => {
            const hrStart = process.hrtime();
            
            const entryDirents = [];
            let retranspile = false;
            for(const dirent of dirents) {
                // TODO: Track with dependency tree (optimised rebuilds)
                if(!force
                    && (Date.now() - statSync(join(dirent.path, dirent.name)).mtimeMs)
                        > optionsWithDefaults.modToleranceMs
                ) continue;
                
                retranspile = true;
                
                if(/^_/i.test(dirent.name)
                && normalize(path) !== normalize(join(dirent.path, dirent.name))) continue;
                
                entryDirents.push(dirent);
            }
            
            retranspile
            && emitter.emit("transpile", {
                iteration: i++,
                executionTimeMs: Math.round(process.hrtime(hrStart)[1] / 1e6),
                files: entryDirents
                    .map((dirent) => {
                        try {
                            return {
                                name: {
                                    parentPath: dirent.path.slice(dirent.parentPath.length),
                                    bare: dirent.name.replace(/\.scss$/i, ""),
                                    full: dirent.name,       
                                },            
                                result: this.fromFile(join(dirent.path, dirent.name), optionsWithDefaults)
                            };
                        } catch(err) {
                            emitter.emit("error", err);
                        }

                        return null;
                    })
                    .filter((fileData) => !!fileData)
            });
            
            setTimeout(tryTranspile, Math.min(1000 * 60 * 60, Math.max(1, optionsWithDefaults.modToleranceMs)));
        };
        
        setImmediate(() => tryTranspile(true));

        return emitter;
    }
}

module.exports = { Transpiler };