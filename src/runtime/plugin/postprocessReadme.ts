import makeAlert from '../components/makeAlert';

const alwaysLoadSettingKey = 'always-load-external';

const alwaysLoadsExternalImages = () => {
	return window.localStorage?.getItem(alwaysLoadSettingKey) === 'always';
};

const neverLoadsExternalImages = () => {
	return window.localStorage?.getItem(alwaysLoadSettingKey) === 'never';
};

const setAlwaysLoadsExternalImages = () => {
	window.localStorage?.setItem(alwaysLoadSettingKey, 'always');
};

const setNeverLoadsExternalImages = () => {
	window.localStorage?.setItem(alwaysLoadSettingKey, 'never');
};

const postprocessReadme = (readmeContainer: HTMLElement) => {
	// Add IDs to headers so that they can be linked to
	const headers = readmeContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
	for (const header of headers) {
		if (header.textContent) {
			header.setAttribute('id', encodeURIComponent(header.textContent.toLocaleLowerCase()));
		}
	}

	// If any external images, show a popup to enable them
	const externalImages: NodeListOf<HTMLImageElement> =
		readmeContainer.querySelectorAll('img[data-original-src]');

	const showAllExternalImages = () => {
		for (const img of externalImages) {
			img.src = img.getAttribute('data-original-src') ?? '';
		}
	};

	const hideAllExternalImages = () => {
		for (const img of externalImages) {
			img.src = '';
		}
	};

	const showExternalImagesOptions = () => {
		const alertMessage =
			'This document contains external images, which can potentially ' +
			'load <a href="https://en.wikipedia.org/wiki/HTTP_cookie">tracking cookies</a> ' +
			'into your browser.';

		const alertDialog = makeAlert({
			content: {
				html: alertMessage,
			},
			onDismiss: () => {
				// As per the documentation, focus should be set to a
				// reasonable location on dismiss:
				// https://getbootstrap.com/docs/5.3/components/alerts/#dismissing
				readmeContainer.focus();
				showExternalImageConfigButton();
			},
		});
		alertDialog.addAction('Show once', () => {
			showAllExternalImages();
			alertDialog.dismissDialog();
		});
		alertDialog.addAction('Always show', () => {
			setAlwaysLoadsExternalImages();
			showAllExternalImages();
			alertDialog.dismissDialog();
		});
		alertDialog.addAction('Never show', () => {
			setNeverLoadsExternalImages();
			hideAllExternalImages();
			alertDialog.dismissDialog();
		});

		readmeContainer.insertAdjacentElement('afterbegin', alertDialog.element);
		return alertDialog.element;
	};

	const showExternalImageConfigButton = () => {
		const configButton = document.createElement('button');
		configButton.classList.add('btn', 'external-images-config-button');

		configButton.setAttribute('aria-label', 'External images settings');
		configButton.innerHTML = '<i class="fa-solid fa-gear" alt=""></i>';

		configButton.onclick = () => {
			configButton.remove();

			const alertDialog = showExternalImagesOptions();
			alertDialog.focus();
		};

		readmeContainer.insertAdjacentElement('afterbegin', configButton);
	};

	if (externalImages.length > 0) {
		if (alwaysLoadsExternalImages()) {
			showAllExternalImages();

			// Allow configuring
			showExternalImageConfigButton();
		} else if (!neverLoadsExternalImages()) {
			// Show allow popup
			showExternalImagesOptions();
		} else {
			showExternalImageConfigButton();
		}
	}
};

export default postprocessReadme;
