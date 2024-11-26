#!/usr/bin/env node


const { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } = require("fs");
const { join, dirname, resolve, extname } = require("path");

const { createTranspiler } = require("./api");

const _config = {
    watchIntervalMs: 1000
};


class Args {
	static #retrieveKeyIndex(name, shorthand) {
    	return Math.max(
            process.argv.slice(2).indexOf(`--${name.toLowerCase()}`),
            shorthand
                ? process.argv.slice(2).indexOf(`-${shorthand.toUpperCase()}`)
                : -1
        );
	}
    
	static parsePositional(index = 0) {
		const positional = process.argv.slice(2)[index];

    	return !/^\-/.test(positional) ? positional : undefined;
	}

	static parseFlag(key, shorthand) {
    	return (Args.#retrieveKeyIndex(key, shorthand) >= 0);
	}

    static parseOption(key, shorthand) {
    	const index = Args.#retrieveKeyIndex(key, shorthand) + 1;
    	const value = (index && index < process.argv.slice(2).length)
        ? process.argv.slice(2)[index]
        : undefined;
        return {
    		string: value,
    		number: +value
    	};
	}
}


if(Args.parsePositional(0) === "help") {
    console.log(readFileSync(join(__dirname, "../cli.help.txt")).toString());

    process.exit(0);
}


function readOverrideVarsFile(overrideVarsFilePath = null) {
    if(!overrideVarsFilePath) return "";

    const absoluteOverrideVarsFilePath = resolve(overrideVarsFilePath);
    if(!existsSync(absoluteOverrideVarsFilePath))
        throw new ReferenceError(`Override variables file not found ${absoluteOverrideVarsFilePath}`);

    const contents = readFileSync(absoluteOverrideVarsFilePath).toString();
    const extension = extname(absoluteOverrideVarsFilePath)
        .toLowerCase()
        .replace(/^\./, "");
    switch(extension) {
        case "json":
            return JSON.parse(contents);
        case "sass":
        case "scss":
            return contents;
    }

    throw new SyntaxError(`Invalid overides variable file format '${extension}'`);
}


const sourceFile = resolve(process.cwd(), Args.parsePositional(0) ?? ".");
const isSingleFileSource = statSync(sourceFile).isFile();

createTranspiler( {
    development: Args.parseFlag("watch", "W"),
    library: Args.parseOption("library", "L").string,
    watchIntervalMs:_config.watchIntervalMs,
    variables: readOverrideVarsFile(Args.parseOption("variables", "V").string)
})
.watchFile(sourceFile)
.on("transpile", (flecssResult) => {
    flecssResult
    .files
    .forEach(file => {
        const target = Args.parsePositional(1) ?? ".";
        const path = resolve(
            process.cwd(),
            target,
            (!isSingleFileSource || !/\.css$/i.test(target))
                ? join(file.name.parentPath, `${file.name.bare}.css`)
                : ""
        );
        
        mkdirSync(dirname(path), {
            recursive: true
        });
        writeFileSync(path, file.result.css);
    });
    
    const date = new Date();
    const dateSequence = [ date.getHours(), date.getMinutes(), date.getSeconds() ]
    .map((segment) => segment.toString().padStart(2, "0"))
    .join(":");
    console.log([
        flecssResult.iteration ? "\x1b[1A\x1b[0J" : "",
        `\x1b[2m${dateSequence}\x1b[22m `,
        `\x1b[38;2;${[ 21, 21, 209 ].join(";")}m`,
        `flecss transpiled ${
            flecssResult.files.length
        } file${
            (flecssResult.files.length - 1) ? "s" : ""
        } (${
            flecssResult.executionTimeMs
        }ms)`,
        "\x1b[0m"
    ].join(""));

    !Args.parseFlag("watch", "W")
    && process.exit(0);
})
.on("error", (err) => {
    console.error(`\x1b[31m${
        Args.parseFlag("print-stacktrace")
            ? (err.stack || err)
            : err
    }\x1b[0m`);

    process.exit(1);
});