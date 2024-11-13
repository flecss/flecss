const path = require("path");
const fs = require("fs");

const api = require("../lib/api");


const DIST_PATH = path.join(__dirname, "../dist");
fs.mkdirSync(DIST_PATH, {
    recursive: true
});


function buildLibrary(libraryName) {
    const distPath = path.join(DIST_PATH, `${libraryName}.css`);
    
    fs.writeFileSync(distPath, api.createTranspiler({
        library: libraryName
    }).fromString("").css);
    
    console.log(`\x1b[2m→ \x1b[22m\x1b[33mBuilt '${libraryName}' to ${distPath}\x1b[0m`);
}


buildLibrary("flecss");
buildLibrary("flecss.min");
buildLibrary("flecss.min.shorthand");