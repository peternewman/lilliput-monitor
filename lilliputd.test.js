// Import the necessary modules and classes
const { PassThrough } = require('stream')

// Define the test suite for LilliputD
describe('LilliputD', () => {
	let instance

	const LilliputD = require('./lilliputd');

	beforeEach(() => {
		var tunnel = new PassThrough()
		instance = new LilliputD({ stream: tunnel }, { disconnect: true })
		instance.emitter.emit = jest.fn()
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe('status response', () => {
		test('should handle normal status response', () => {
			expect(instance.decode(Buffer.from('5a470020010200fffe0033213232006402070400060000104000000400024e6f205369676e616c2020202020202020204d6f6e69746f72202020202020202020220210320110dd', 'hex'))).toMatchObject({
				"name": "LilliputMonitor",
				"req": "status",
				"value": {"backlight": 100, "brightness": 51, "color-temp": "6500K", "contrast": 33, "meter": "None", "mv2-1": "SDI2-SDI1", "mv4-3": "SDI4-SDI3", "right-left-out": "2-1", "saturation": 50, "sharpness": 0, "source": "HDMI", "tally-umd1": "Off-Off-Green", "tint": 50, "umd3-umd2": "Off-Off", "umdnum-umd4": "1-Off-Green", "volume": 0}
			})
			expect(instance.emitter.emit).toHaveBeenCalled()
		})
	})
})
