// Handles loading assets for a single plugin

import path from 'path';
import { BuildConfig, JoplinPlugin, PluginAssetData, PluginIconSet } from '../../lib/types';
import cachedFetch from '../fetch/cachedFetch';
import fetchFromGitHub from '../fetch/fetchFromGitHub';
import renderMarkdown from './renderMarkdown';

class GitHubReference {
	private gitHubBaseUri: string;
	public constructor(
		public readonly organization: string,
		public readonly project: string,
	) {
		this.gitHubBaseUri = `${organization}/${project}/HEAD`;
	}

	public convertURIToGitHubURI(uri: string, baseDirectory: string) {
		uri = uri.startsWith('.') ? path.join(baseDirectory, uri) : uri;

		// Avoid relative URLs that still aren't resolved
		if (uri.startsWith('..')) {
			return null;
		}

		// Avoid non-GitHub links
		if (uri.match(/^\w+:\/\//)) {
			return null;
		}

		return `https://raw.githubusercontent.com/${this.gitHubBaseUri}/${uri}`;
	}

	public convertManifsetURIToGitHubURI(uri: string) {
		return this.convertURIToGitHubURI(uri, 'src/');
	}

	public async fetchFile(filePath: string) {
		const fetchResponseData = await fetchFromGitHub(`${this.gitHubBaseUri}/${filePath}`);

		if (fetchResponseData.status === 200) {
			return fetchResponseData;
		}

		console.log(
			'Error fetching file. Status: ',
			fetchResponseData.status,
			fetchResponseData.result,
		);

		// Some error fetching
		return null;
	}
}

interface NPMPackageVersionData {
	dist: {
		tarball: string;
		integrity: string;
	};
	version: string;
}

interface NPMPackageMetadata {
	readme: string;
	homepage: string;
	versions: Record<string, NPMPackageVersionData>;
}

class NPMReference {
	private packageMetadata: NPMPackageMetadata | null | undefined = undefined;

	public constructor(public readonly packageName: string) {}

	public async getPackageMetadata(): Promise<NPMPackageMetadata | null> {
		if (this.packageMetadata !== undefined) {
			return this.packageMetadata;
		}

		const data = await cachedFetch(['https://registry.npmjs.org/'], this.packageName);

		// If unsuccessful, return null and warn
		if (data.status !== 200) {
			console.log('Error fetching package data', data.status, data.result);
			return null;
		}

		const packageData = JSON.parse(data.result);
		this.packageMetadata = packageData;

		return packageData;
	}
}

export default class PluginAssetLoader {
	private gitHubReference?: GitHubReference;
	private npmReference: NPMReference;

	public constructor(
		private manifest: JoplinPlugin,
		private buildConfig: BuildConfig,
	) {
		// Capture groups:
		// 1. The username/organization
		// 2. The project name
		const githubURLRegex = /^https?:\/\/(?:www\.)?github.com\/([^/]+)\/([^/]+)/;

		let githubRepositoryMatch = githubURLRegex.exec(manifest.repository_url ?? '');
		if (!githubRepositoryMatch) {
			githubRepositoryMatch = githubURLRegex.exec(manifest.homepage_url ?? '');
		}

		if (githubRepositoryMatch) {
			const organization = githubRepositoryMatch[1];
			const project = githubRepositoryMatch[2].replace(/\.git$/, '');

			this.gitHubReference = new GitHubReference(organization, project);
		}

		this.npmReference = new NPMReference(manifest._npm_package_name);
	}

	// For testing only.
	// @internal
	public getReadmeFetchUri() {
		if (this.gitHubReference) {
			return this.gitHubReference.convertURIToGitHubURI('README.md', '');
		}

		// No direct README URI for NPM packages.
		return null;
	}

	private async getReadme() {
		// First try from GitHub
		if (this.gitHubReference) {
			const readme = await this.gitHubReference.fetchFile('README.md');

			if (readme && readme.status === 200) {
				return readme.result;
			}
		}

		// Fall back to NPM
		const npmReadme = (await this.npmReference.getPackageMetadata())?.readme;
		return npmReadme ?? 'No README';
	}

	public async getRenderedReadme() {
		const transformRelativeLinks = (link: string) => {
			return this.gitHubReference?.convertURIToGitHubURI(link, '') ?? '#';
		};

		return renderMarkdown(await this.getReadme(), transformRelativeLinks);
	}

	public async getScreenshots() {
		if (!this.manifest.screenshots) {
			return [];
		}

		const screenshots = [];

		for (const screenshot of this.manifest.screenshots) {
			const screenshotURI = this.gitHubReference?.convertManifsetURIToGitHubURI(screenshot.src);

			if (!screenshotURI) {
				continue;
			}

			screenshots.push({
				uri: screenshotURI,
				label: screenshot.label ?? 'Unlabeled screenshot',
			});
		}

		return screenshots;
	}

	public async getIcon() {
		if (!this.manifest.icons || !this.gitHubReference) {
			return null;
		}

		const targetIconSizes: (keyof PluginIconSet)[] = ['256', '128', '48', '32'];

		// Select the largest icon by default
		for (const iconSize of targetIconSizes) {
			const iconUri = this.manifest.icons[iconSize];
			if (iconUri) {
				const gitHubUri = this.gitHubReference.convertManifsetURIToGitHubURI(iconUri);

				if (gitHubUri) {
					return gitHubUri;
				}
			}
		}

		return null;
	}

	public async loadAssets(): Promise<PluginAssetData> {
		const defaultIconUri = path.join(this.buildConfig.site, 'plugin-icon-placeholder.svg');
		return {
			readme: await this.getRenderedReadme(),
			screenshots: await this.getScreenshots(),
			iconUri: (await this.getIcon()) ?? defaultIconUri,
		};
	}
}