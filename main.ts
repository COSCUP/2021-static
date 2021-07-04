import { mkdir, rm, writeFile } from 'fs/promises'
import { openSync, closeSync } from 'fs';
import path from 'path'
import axios from 'axios'
import { GoogleSpreadsheet } from "google-spreadsheet"

const DIST = path.join(__dirname, './dist')

const noop = () => { }

async function getLoadedSpreadsheetDocument() {
  const API_KEY = process.env.SPREADSHEET_API_KEY

  if (!API_KEY) return null

  const SPREADSHEET_ID = '1-n8ZnmZ3jssdhYSzkRF6ngOvlsea_qQVLP0E_bexzxY'
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID)
  doc.useApiKey(API_KEY)
  try {
    await doc.loadInfo()
    return doc
  } catch (e) {
    console.log(e)
    return null
  }
}

async function downloadImages(images: [string, string][], outputPath: string) {
  await mkdir(outputPath, { recursive: true })
  for (const entry of images) {
    const { data: buffer } = await axios.get<Buffer>(entry[1], {
      responseType: 'arraybuffer'
    })
    await writeFile(path.join(outputPath, `${entry[0]}.png`), buffer)
  }
}

type SponsorLevelTuple = ['titanium', 'diamond', 'co-organizer', 'gold', 'bronze', 'silver', 'special-thanks', 'friend']
type SponsorLevel = SponsorLevelTuple[number]
type SponsorRowKeys = 'id' | 'level' | 'name:en' | 'name:zh-TW' | 'intro:en' | 'intro:zh-TW' | 'link' | 'image' | 'canPublish'
type SponsorRow = {
  [K in SponsorRowKeys]: K extends 'level'
  ? SponsorLevel
  : K extends 'canPublish'
  ? 'Y' | 'N'
  : string;
}

async function downloadLogoOfSponsors(doc: GoogleSpreadsheet) {
  const sheetId = '178607707'
  const sheet = doc.sheetsById[sheetId]
  const rows = await sheet.getRows() as unknown as SponsorRow[]
  const images = rows
    .filter((r) => {
      return r.canPublish === 'Y' && r.id.length > 0 && r.image.length > 0
    })
    .map((r) => {
      return [r.id, r.image] as [string, string]
    })

  const outputPath = path.join(DIST, 'images', 'sponsor')
  await mkdir(outputPath, { recursive: true })
  await downloadImages(images, outputPath)
}

type SponsorNewsRowKeys = 'sponsorId' |'newsId' | 'description' | 'link' | 'image:vertical' | 'image:horizontal' | 'specialWeight' | 'canPublish'
type SponsorNewsRow = {
  [K in SponsorNewsRowKeys]: K extends 'canPublish'
    ? 'Y' | 'N'
    : string;
}

async function downloadImagesOfSponsorNews(doc: GoogleSpreadsheet) {
  const sheetId = '1344636990'
  const sheet = doc.sheetsById[sheetId]
  const rows = await sheet.getRows() as unknown as SponsorNewsRow[]
  const images = rows
    .filter((r) => {
      return r.canPublish === 'Y' && 
        r.sponsorId.length > 0 && 
        r.newsId.length > 0 && 
        r['image:horizontal'].length > 0 && 
        r['image:vertical'].length > 0
    })
    .flatMap((r) => {
      return [
        [`${r.sponsorId}-${r.newsId}-horizontal`, r['image:horizontal']] as [string, string],
        [`${r.sponsorId}-${r.newsId}-vertical`, r['image:vertical']] as [string, string]
      ]
    })

  const outputPath = path.join(DIST, 'images', 'sponsor-news')
  await mkdir(outputPath, { recursive: true })
  await downloadImages(images, outputPath)
}
type YoutubeRowKeys = 'room' | 'link'

async function YoutubeLinkGen(doc: GoogleSpreadsheet) {
  const sheetId = '2044734677'
  const sheet = doc.sheetsById[sheetId]
  const filename = './dist/link.json';
  const rows = await sheet.getRows() as unknown as YoutubeRowKeys[]
  let result = {};
  rows.flatMap((r) => {
    result[`${r['room']}`] = r['link']
    })
    let fd;

    try {
      fd = openSync(filename, 'a');
      await writeFile(filename, `${JSON.stringify(result)}`);
    } catch (err) {
    } finally {
      if (fd !== undefined)
        closeSync(fd);
    }
}

async function run() {
  const loadedDoc = await getLoadedSpreadsheetDocument()
  if (loadedDoc === null) {
    console.log('Cannot load the spreadsheet')
    return
  }

  await rm(DIST, { recursive: true, force: true }).catch(noop)
  await downloadLogoOfSponsors(loadedDoc)
  await downloadImagesOfSponsorNews(loadedDoc)
  await YoutubeLinkGen(loadedDoc)
  console.log('Done')
}

run()
