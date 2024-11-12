const path = require("path");
const fs = require("fs");

const api = require("../lib/api");


const DIST_PATH = path.join(__dirname, "../dist");
fs.mkdirSync(DIST_PATH, {
    recursive: true
});


const transpiler = api.createTranspiler();

function buildLibrary(libraryName) {
    const distPath = path.join(DIST_PATH, `${libraryName}.css`);
    
    fs.writeFileSync(distPath, transpiler.fromString("", {
        library: "flecss"
    }).css);

    console.log(`\x1b[2m→ \x1b[22m\x1b[33mBuilt '${libraryName}' to ${distPath}\x1b[0m`);
}


buildLibrary("flecss");
buildLibrary("flecss.min");
buildLibrary("flecss.min.shorthand");