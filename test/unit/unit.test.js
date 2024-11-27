const { deepEqual } = require("assert");
const { join } = require("path");

const flecss = require("../../lib/api");


const transpiled = flecss
    .createTranspiler({
        development: true,
        variables: require(join(__dirname, "./flecss/overrides.json"))
    })
    .fromFile(join(__dirname, "./flecss/_test.scss"));

deepEqual(transpiled.loadedUrls.length, 27);
deepEqual(transpiled.css.length > 100, true);
deepEqual(/a\s*\{\s*color:\s*red\s*[;}]/.test(transpiled.css), true);
deepEqual(/a\s*\{\s*color:\s*var\(--flecss__color_lime--normal\)\s*[;}]/.test(transpiled.css), true);

const transpiledStandalone = flecss
    .createTranspiler({
        library: "standalone"
    })
    .fromFile(join(__dirname, "./standalone/_test.scss"));

deepEqual(transpiledStandalone.loadedUrls.length, 1);
deepEqual(transpiledStandalone.css.length < 100, true);
deepEqual(/a\s*\{\s*color:\s*red\s*[;}]/.test(transpiledStandalone.css), true);
deepEqual(/a\s*\{\s*color:\s*lime\s*[;}]/.test(transpiledStandalone.css), false);


console.log("\x1b[32mUnit tests succeeded.\x1b[0m");