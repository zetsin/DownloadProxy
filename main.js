'use strict'
const fs = require('fs')
const url = require('url')
const http = require('http')
const https = require('https')
const path = require('path')

const express = require('express')
const bodyParser = require('body-parser')

const global = {
	downloadUrl: __dirname + '/public/download/',
	downloadingUrl: __dirname + '/public/downloading/',
	downloadingObj: {}
}

const app = express()
app.use(express.static('public', {
	dotfiles: 'allow'
}))

app.get('/download', (req, res, next) => {
	fs.readdir(global.downloadUrl, (err, files) => {
		if(err) {
			res.status(404).end()
			return
		}
		let result = {
			downloaded: [],
			downloading: [],
		}

		for(let key in global.downloadingObj) {
			result.downloading.push(global.downloadingObj[key])
		}

		if(!files.length) {
			res.json(result)
			return
		}

		let erred = false
		files.forEach((file, index) => {
			fs.stat(global.downloadUrl + file, (err, stat) => {
				if(erred || err) {
					erred = true
					res.status(404).end()
					return
				}
				let item = {
					file: file,
					size: stat.size,
					birthtime: Date.parse(stat.birthtime),
					atime: Date.parse(stat.atime),
					mtime: Date.parse(stat.mtime),
					ctime: Date.parse(stat.ctime),
				}
				result.downloaded.push(item)

				if(index == files.length - 1) {
					res.json(result)
				}
			})
		})
	})
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
		global.downloadingObj[guid] = {
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
				delete global.downloadingObj[guid]
				get(remote.headers.location)
				return
			}
			res.set(remote.headers)

			let name = urlobj.href
			if(req.query.name == 'name') {
				name = path.parse(urlobj.hostname + urlobj.pathname).base
			} else if (req.query.name == 'random') {
				name = Math.random().toString(35).slice(2, 66)
				console.log(name)
			}
			name = encodeURIComponent(name)
			let downloadingName = `${global.downloadingUrl}${guid}${name}`
			let downloadName = `${global.downloadUrl}${guid}${name}`
			global.downloadingObj[guid].total = remote.headers['content-length']
			global.downloadingObj[guid]._t = Date.now()

			remote.on('data', (data) => {
				res.write(data)
				global.downloadingObj[guid].current += data.length
				fs.appendFile(downloadingName, data, (err) => {})
			})
			remote.on('end', () => {
				res.end()
				delete global.downloadingObj[guid]
				fs.rename(downloadingName, downloadName, () => {})
			})

		}).on('error', (e) => {
			console.log(e)
			if(location) {
				return
			}
			res.status(404).end()
			delete global.downloadingObj[guid]
		})
	}
})


app.listen(3000)