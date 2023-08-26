const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild");
const peggy = require("peggy");
const tspegjs = require("ts-pegjs")
const yargs = require("yargs/yargs")
const yargsHelpers = require("yargs/helpers")

/** @type{esbuild.LogLevel} */
const logLevel = 'info'
let concurrentBuilds = 0;
let completedAt = 0
let mode = 'build'

yargs(yargsHelpers.hideBin(process.argv))
.command("build", "build app", () => mode = 'build')
.command("watch", "watch mode", () => mode = 'watch')
.option("verbose", { alias: 'v', type: 'boolean', description: 'Verbose Op'})
.parse()


console.log("Mode: ", mode)
/** @type{esbuild.Plugin} logger */
const logger = {
    name: 'logger',
    setup(build) {
        /** @type{esbuild.PluginBuild} build*/
        build.onStart(() => {
            // console.log("start building: ", build.initialOptions.outfile)
            if (concurrentBuilds++ == 0 && (performance.now() - completedAt > 5000)) {
                console.log('clear!')
                console.clear()
            }
        })

        // build.onResolve({ filter: /pegjs/}, ({path: filePath}) => {
        //     const filename = path.relative(process.cwd(), filePath);
        //     console.log('resolve', filename)
        //     return undefined
        // })

        build.onEnd((result) => {
            /** @type{esbuild.BuildResult} result */

            completedAt = performance.now()
            const date = new Date

            --concurrentBuilds;
            const fileName = path.relative(process.cwd(), build.initialOptions.outfile)
            let errors = ""
            let warnings = ""
            result.errors.forEach( e => errors += `${e.location.file}:${e.location.line}: error: ${e.text}\n\tin ${e.location.lineText}\n`)
            result.warnings.forEach( e => warnings += `${e.location.file}:${e.location.line}: warning: ${e.text}\n\tin ${e.location.lineText}\n`)

            const prefix = (errors || warnings) ? "\n" : ""
            if (errors) {
                console.error(date, 'ERROR ', fileName, prefix, errors, warnings)
            }
            else {
                console.error(date, 'SUCCESS', fileName, prefix, errors, warnings)
            }
        })
    }
}

/** @type{esbuild.Plugin} pegjsPlugin */
const pegjsPlugin = ({outFile, outDir}) => ({
    name: 'pegjs',
    setup(build) {
        /** @type{esbuild.PluginBuild} build*/
        build.onLoad({ filter: /\.pegjs$/ }, async ({path: filePath}) => {
            const filename = path.relative(process.cwd(), filePath);
            console.log("Process: ", filename)
            const source = await fs.promises.readFile(filePath, "utf8");

            const result = peggy.generate(source, {
                output: "source",
                // output: "source-and-map",
                // output: "source-with-inline-map",
                grammarSource: filename,
                format: "commonjs",
                plugins: [tspegjs],
                tspegjs: {
                    customHeader: [
                        "import { UnitInfo } from './lang';",
                        "import { ParserHelper, CurrentContext } from './ParserHelper';"
                    ].join("\n")
                }
            })

            const outputFileName = path.basename(filename, ".pegjs") + "-parse.ts";

            const output = outFile ?? path.resolve(outDir ?? path.dirname(filename), outputFileName)
            await fs.promises.mkdir(path.dirname(output), { recursive: true })
            await fs.promises.writeFile(output, result);

            return {
                contents: result,
                loader: 'ts',
            }
        })
    }
})

/** @type{esbuild.BuildOptions} common */
const common = {
    bundle: true,
    external: ["vscode"],
    format: 'cjs',
    platform: 'node',
    sourcemap: true,
    treeShaking: true,
    color: true,
    logLevel: logLevel,
    plugins: [ logger, pegjsPlugin({
        // outFile:  path.resolve("server", "src", "zs-parser.ts"),
        // outDir: path.resolve("server", "src")
    }) ]
};

/** @type{esbuild.BuildOptions} ext */

const extension = {
    ...common,
    entryPoints: [ path.resolve("client", "src", "extension.ts")],
    outfile: path.resolve("out", "zscript.js"),
}

/** @type{esbuild.BuildOptions} server */
const server = {
    ...common,
    entryPoints: [ path.resolve("server", "src", "server.ts")],
    outfile: path.resolve("out", "zscript-lsp.js"),
}

/**@type{esbuild.BuildOptions} parser */
const parser = {
    ...common,
    entryPoints: [ path.resolve("server", "src", "zs.pegjs")]
}

switch(mode) {
    case 'build':
        esbuild.build(extension)
        esbuild.build(server)
        break

    case 'watch':
        esbuild.context(extension).then(ctx => ctx.watch())
        esbuild.context(server).then(ctx => ctx.watch())
        break
}
