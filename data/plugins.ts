async function fetchPluginData() {
	let plugins = []
	const mirrors = [
		'https://raw.githubusercontent.com/joplin/plugins/master/manifests.json',
		'https://raw.staticdn.net/joplin/plugins/master/manifests.json',
		'https://raw.fastgit.org/joplin/plugins/master/manifests.json',
	]
	for (let index = 0; index < mirrors.length; index++) {
		try {
			plugins = await (await fetch(mirrors[index])).json()
			return Object.values(plugins)
		} catch (error) {
			continue
		}
	}
	throw new Error("Cannot find avalible Github mirror");
}

module.exports = function () {
	const plugins = fetchPluginData()
	return plugins
}
