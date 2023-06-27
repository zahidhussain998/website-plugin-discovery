import Mustache from 'mustache';
import path from 'node:path';
import klawSync from 'klaw-sync';
import fs from 'fs-extra';
import { type JoplinPlugin } from './data/plugins';
import { devConfig, productionConfig, type BuildConfig } from './config';

export interface Template {
	path: string;
	name: string;
	content: string;
}

export type Data = Record<string, any>;

function clearBuildPath(buildPath: string): void {
	try {
		fs.rmSync(buildPath, { recursive: true });
	} catch (err) {
		console.log(err);
	}
}

function copyStaticFiles(buildPath: string): void {
	try {
		fs.copySync('./assets', buildPath);
	} catch (err) {
		console.log(err);
	}
}

export async function loadData(): Promise<Data> {
	const dataFiles = klawSync('./data', { nodir: true });
	const data: Data = {};
	for (let i = 0; i < dataFiles.length; i++) {
		const file = dataFiles[i];
		if (!file.path.includes('.test') && file.path.endsWith('.js')) {
			data[path.basename(file.path, '.js')] = await (await import(file.path)).default();
		}
	}
	return data;
}

export function loadTemplate(): Template[] {
	const templateFiles = klawSync('./pages', { nodir: true });
	return templateFiles.map((file) => {
		return {
			name: path.basename(file.path, '.mustache'),
			path: path.parse(file.path).dir,
			content: fs.readFileSync(file.path, 'utf8'),
		};
	});
}

export function loadTemplatePartials(): Data {
	const partialFiles = klawSync('./components', { nodir: true });
	const partialData: Data = {};
	partialFiles.forEach((file) => {
		partialData[path.basename(file.path, '.mustache')] = fs.readFileSync(file.path, 'utf8');
	});
	return partialData;
}

export function renderTemplates(
	config: BuildConfig,
	templates: Template[],
	globalData: Data,
	partials: Data,
	routes: Data,
	distRootPath: string
): void {
	templates.forEach((template) => {
		if (template.name === '[pluginName]') {
			console.log(`Rendering dynamic route pluginName`);
			routes.pluginName.forEach((key: string) => {
				const distPath = path.join(
					path.resolve(distRootPath),
					path.relative(config.rootDir, template.path).replace('pages', ''),
					key,
					'index.html'
				);
				console.log(`- Rendering ${distPath}`);
				const data = {
					...globalData,
					path: key,
					plugin: {
						...globalData.plugins.raw[key],
					},
				};
				const output = Mustache.render(template.content, data, partials);
				fs.mkdirsSync(path.dirname(distPath));
				fs.writeFileSync(distPath, output, 'utf8');
			});
		} else {
			const distPath = path.join(
				path.resolve(distRootPath),
				path.relative(config.rootDir, template.path).replace('pages', ''),
				template.name + '.html'
			);
			console.log(`Rendering ${distPath}`);
			const output = Mustache.render(template.content, globalData, partials);
			fs.mkdirsSync(path.dirname(distPath));
			fs.writeFileSync(distPath, output, 'utf8');
		}
	});
}

export async function build(mode: 'dev' | 'production'): Promise<void> {
	const config = mode === 'dev' ? devConfig : productionConfig;

	fs.ensureDirSync(config.distDir);
	clearBuildPath(config.distDir);
	copyStaticFiles(config.distDir);
	const template = loadTemplate();
	const globalData: Data = {
		...(await loadData()),
		config,
	};
	const partials = loadTemplatePartials();
	const routes = {
		pluginName: globalData.plugins.all.map((plugin: JoplinPlugin) => plugin.id),
	};
	renderTemplates(config, template, globalData, partials, routes, config.distDir);
}
