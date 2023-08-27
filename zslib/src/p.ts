// import './zscript.pegjs'
import * as parser from './lang/zscript-parse'
import * as path from 'path'
import * as fs from 'fs'
import { UnitInfo } from './lang/UnitInfo'
import { ConsoleSink, LogLevel, logSystem } from './util/logger'

const topDir = '/home/osesov/zodiac/valhalla.tmnl/components/powerup/script/MEDIAFIRST/start/scripts'
// const fileName = "gui/tcui/guide/GuideChannelListItem.zs"
// const fileName = 'framework/common.zs'
// const fileName = 'gui/tcui/guide/GuideInfo.zs'
const fileName = 'framework/Scene.zs'
const filePath = path.resolve(topDir, fileName)
const text = fs.readFileSync(filePath, 'utf-8')

async function main()
{
    logSystem.addSink( new ConsoleSink )
    logSystem.setLevel(LogLevel.DEBUG)

    try {
        const logger = logSystem.getLogger("main")
        const begin = Date.now()
        const result: UnitInfo = parser.parse(text, {
            grammarSource: path.relative(process.cwd(), filePath)
        })

        const end = Date.now()

        logger.info('Took {time}', (end - begin) / 1000);
        logger.info('Parse result: {RESULT}', result)
    }

    catch (e: unknown) {
        if (e instanceof parser.PeggySyntaxError) {
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
