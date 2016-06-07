'use strict'
const fs = require('fs')
const url = require('url')
const http = require('http')
const https = require('https')
const path = require('path')

const express = require('express')
const bodyParser = require('body-parser')

const global = {
	downloadedPath: __dirname + '/public/download/',
	downloadingPath: __dirname + '/public/downloading/',
	downloadObj: {
		downloaded: {},
		downloading: {}
	}
}

const app = express()
app.use(express.static('public', {
	dotfiles: 'allow'
}))

app.get('/download', (req, res, next) => {
	let result = {
		downloaded: [],
		downloading: [],
	}

	for(let key in global.downloadObj.downloaded) {
		result.downloaded.push(global.downloadObj.downloaded[key])
	}

	for(let key in global.downloadObj.downloading) {
		result.downloading.push(global.downloadObj.downloading[key])
	}
	res.json(result)
})

app.get('/:url', (req, res, next) => {
	get(req.params.url)

	function get(urlparam) {
		if(!urlparam) {
			res.status(404).end()
			return
		}

		let urlobj = url.parse(urlparam)

		let guid = `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}_`
		global.downloadObj.downloading[guid] = {
			file: urlobj.href,
			current: 0,
			total: 0,
			_t: 0 
		}

		let location = false
		let protocol = urlobj.protocol == 'https:' ? https : http
		protocol.get(urlobj.href, (remote) => {
			if(remote.headers.location) {
				location = true
				delete global.downloadObj.downloading[guid]
				get(remote.headers.location)
				return
			}
			res.set(remote.headers)

			let name = urlobj.href
			if(req.query.name == 'name') {
				name = path.parse(urlobj.hostname + urlobj.pathname).base
			} else if (req.query.name == 'random') {
				name = Math.random().toString(35).slice(2, 66)
			}
			name = encodeURIComponent(name)
			let downloadingName = `${global.downloadingPath}${guid}${name}`
			let downloadName = `${global.downloadedPath}${guid}${name}`
			global.downloadObj.downloading[guid].total = remote.headers['content-length']
			global.downloadObj.downloading[guid]._t = Date.now()

			remote.on('data', (data) => {
				res.write(data)
				global.downloadObj.downloading[guid].current += data.length
				fs.appendFile(downloadingName, data, (err) => {})
			})
			remote.on('end', () => {
				res.end()
				delete global.downloadObj.downloading[guid]
				fs.rename(downloadingName, downloadName, () => {})
			})

		}).on('error', (err) => {
			console.log(err)
			if(location) {
				return
			}
			res.status(404).end()
			delete global.downloadObj.downloading[guid]
		})
	}
})


app.listen(3000)

watchDownloaded()

function watchDownloaded() {
	fs.readdir(global.downloadedPath, (err, files) => {
		if(err) {
			console.log(err)
			return
		}

		let count = 0
		let time = Date.now()
		files.forEach((file, index) => {
			fs.stat(global.downloadedPath + file, (err, stat) => {
				if(!err) {
					global.downloadObj.downloaded[file] = {
						file: file,
						size: stat.size,
						birthtime: Date.parse(stat.birthtime),
						atime: Date.parse(stat.atime),
						mtime: Date.parse(stat.mtime),
						ctime: Date.parse(stat.ctime),
						time: time
					}
				}

				count += 1
				if(count == files.length) {
					for(let key in global.downloadObj.downloaded) {
						if(global.downloadObj.downloaded[key].time != time) {
							delete global.downloadObj.downloaded[key]
						}
					}
					setTimeout(watchDownloaded, 500)
				}
			})
		})
	})
}