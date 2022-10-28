import React from 'react';
import { Html5Qrcode, Html5QrcodeScanType, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { IObjectKeys } from 'types/general';

const qrcodeRegionId = 'html5qr-code-ixo';

type QRScannerProps = {
	verbose?: boolean;
	disableFlip?: boolean;
	fps?: number;
	aspectRatio?: number;
	qrbox?: number;
	width?: string;
	height?: string;
	ErrorDisplay?: () => JSX.Element;
	qrCodeSuccessCallback: (text: string) => void;
	qrCodeErrorCallback: (error: string) => void;
};

class QRScanner extends React.Component<QRScannerProps> {
	constructor(props: QRScannerProps) {
		super(props);
		this.state = { error: false };
	}

	html5Qrcode: Html5Qrcode | undefined;

	render() {
		const ErrorDisplay = this.props.ErrorDisplay;
		// @ts-ignore
		const error = this.state.error;
		return error && ErrorDisplay ? <ErrorDisplay /> : <div id={qrcodeRegionId} style={{ width: this.props.width || 'auto', height: this.props.height || 'auto' }} />;
	}

	componentWillUnmount() {
		if (this.html5Qrcode?.isScanning) this.html5Qrcode?.stop().catch(e => console.log('Error stoping html5Qrcode: ' + e));
	}

	componentDidMount() {
		function createConfig(props: QRScannerProps) {
			var config: IObjectKeys = { supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA], formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] };
			if (props.fps) config.fps = props.fps;
			if (props.qrbox) config.qrbox = { width: props.qrbox, height: props.qrbox };
			if (props.aspectRatio) config.aspectRatio = props.aspectRatio;
			if (props.disableFlip !== undefined) config.disableFlip = props.disableFlip;
			return config;
		}

		var config = createConfig(this.props);

		if (this.html5Qrcode != undefined) return;
		this.html5Qrcode = new Html5Qrcode(qrcodeRegionId, this.props.verbose);
		//@ts-ignore
		this.html5Qrcode.start({ facingMode: 'environment' }, config, this.props.qrCodeSuccessCallback, this.props.qrCodeErrorCallback).catch(err => {
			this.setState({ error: err });
			console.log('QR Scanner error: ' + err);
		});
	}
}

export default QRScanner;
