const path = require("path");
const fs = require("fs");

const { DIST_PATH } = require("./DIST_PATH");


function reportLibraryMeta(libraryName) {
    const stats = fs.statSync(path.join(DIST_PATH, `${libraryName}.css`));
    const meta = {
        "filesize": `${
            Math.round(((stats.size * 2**-10) + Number.EPSILON) * 100) / 100
        }kB`
    };
    
    console.log(`\x1b[33m\x1b[4m${
        libraryName
    }\x1b[24m\n${
        Object.entries(meta)
        .map(entry => `\x1b[2m•\x1b[22m ${entry[0]}: \x1b[1m${entry[1]}\x1b[22m`)
        .join("\n")
    }\x1b[0m`);
}


reportLibraryMeta("flecss");
reportLibraryMeta("flecss.extra");