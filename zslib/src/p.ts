// import './zscript.pegjs'
import * as parser from './zscript-parse'
import * as path from 'path'
import * as fs from 'fs'
import { UnitInfo } from './lang'
import { createRepository } from './zsRepository'
import { FilePosition, Logger } from './logger'
import * as vscode from 'vscode'

const topDir = '/home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts'
// const fileName = "gui/tcui/guide/GuideChannelListItem.zs"
// const fileName = 'framework/common.zs'
// const fileName = 'gui/tcui/guide/GuideInfo.zs'
const fileName = 'framework/Scene.zs'
const filePath = path.resolve(topDir, fileName)
const text = fs.readFileSync(filePath, 'utf-8')

const logger = new class implements Logger
{
    info(msg: string, position?: FilePosition | undefined): void {
        console.info(msg)
    }

    warn(msg: string, position?: FilePosition | undefined): void {
        console.warn(msg)
    }

    error(msg: string, ...args: any[]): void {
        console.error(msg, ...args)
    }

    debug(msg: string): void {
        console.debug(msg)
    }
}

async function main()
{
    const repo = createRepository({includeDirs: []}, logger)
    try {
        const result: UnitInfo = parser.parse(text, {
            grammarSource: path.relative(process.cwd(), filePath)
        })

        console.log('RESULT', result)

        const token = new vscode.CancellationTokenSource()

        const compl = await repo.getCompletions(fileName, "SceneNode", {
            line: 1,
            column: 1
        }, token.token)
    }

    catch (e: any) {
        if (typeof e.format === "function") {
            console.error(e.format([
                { source: fileName, text },
            ]));
            console.error('error', e)
        } else {
            console.error(e)
        }
    }
}

main();
