import { execScripts, importEntry } from '../index';

describe('execScripts', () => {
	it('should support exec inline script correctly', async () => {
		// arrange
		const spyInstance = jest.spyOn(console, 'log');
		spyInstance.mockImplementation(jest.fn());

		const dummyContext = {
			foo: 5,
		};

		try {
			// act
			await execScripts(
				null,
				['<script>console.log(this.foo, window.foo)</script>'],
				dummyContext,
			);

			// assert
			expect(spyInstance).toHaveBeenCalledTimes(1);
			expect(spyInstance).toHaveBeenCalledWith(5, 5);
		} finally {
			spyInstance.mockRestore();
		}
	});

	it('should support exec inline script with hooks correctly', async () => {
		// arrange
		const spyInstance = jest.spyOn(console, 'log');
		spyInstance.mockImplementation(jest.fn());

		const afterExecHook = jest.fn();

		const dummyContext = {
			hello: 'world',
		};

		const expectCode = 'console.log("updated")';
		const script = `<script>${expectCode}</script>`;

		try {
			// act
			await execScripts(
				null,
				[script],
				dummyContext,
				{
					beforeExec(code, scriptSource) {
						expect(code).toBe(expectCode);
						expect(scriptSource).toBe(script);

						return 'console.log("updated")';
					},
					afterExec: afterExecHook,
				}
			);

			// assert
			expect(spyInstance).toHaveBeenCalledTimes(1);
			expect(spyInstance).toHaveBeenCalledWith('updated');
			expect(afterExecHook).toHaveBeenCalledWith(expectCode, script);
		} finally {
			spyInstance.mockRestore();
		}
	});

	it('should support exec remote script correctly', async () => {
		// arrange
		const spyInstance = jest.spyOn(console, 'log');
		spyInstance.mockImplementation(jest.fn());

		const fetch = async () => ({
			text: async () => 'console.log(window.foo)',
		});

		const dummyContext = {
			foo: 6,
		};

		try {
			// act
			await execScripts(null, ['./foo.js'], dummyContext, {
				fetch,
			});

			// assert
			expect(spyInstance).toHaveBeenCalledTimes(1);
			expect(spyInstance).toHaveBeenCalledWith(6);
		} finally {
			spyInstance.mockRestore();
		}
	});

	it('should support exec remote script with hooks correctly', async () => {
		// arrange
		const spyInstance = jest.spyOn(console, 'log');
		spyInstance.mockImplementation(jest.fn());

		const afterExecHook = jest.fn();

		const dummyContext = {
			hello: 'world',
		};

		const expectCode = 'console.log(this.hello, window.hello)';
		const script = './bar.js';

		const fetch = async () => ({
			text: async () => expectCode,
		});

		try {
			// act
			await execScripts(
				null,
				[script],
				dummyContext,
				{
					fetch,
					beforeExec(code, scriptSource) {
						expect(code).toBe(expectCode);
						expect(scriptSource).toBe(script);

						return 'console.log("updated")';
					},
					afterExec: afterExecHook,
				}
			);

			// assert
			expect(spyInstance).toHaveBeenCalledTimes(1);
			expect(spyInstance).toHaveBeenCalledWith('updated');
			expect(afterExecHook).toHaveBeenCalledWith(expectCode, script);
		} finally {
			spyInstance.mockRestore();
		}
	});

	it('should support exec script with importEntry correctly(html url)', async () => {
		// arrange
		const spyInstance = jest.spyOn(console, 'log');
		spyInstance.mockImplementation(jest.fn());

		const afterExecHook = jest.fn();

		const dummyContext = {
			hello: 'world',
		};

		const expectCode = 'console.log(this.hello, window.hello)';
		const script = `<script>${expectCode}</script>`;

		const fetch = async () => ({
			text: async () => script,
		});

		try {
			// act
			const result = await importEntry(
				'./dummy.html',
				{
					fetch,
				}
			);

			await result.execScripts(dummyContext, true, {
				beforeExec(code, scriptSource) {
					expect(code).toBe(expectCode);
					expect(scriptSource).toBe(script);

					return 'console.log("updated")';
				},
				afterExec: afterExecHook,
			});

			// assert
			expect(spyInstance).toHaveBeenCalledTimes(1);
			expect(spyInstance).toHaveBeenCalledWith('updated');
			expect(afterExecHook).toHaveBeenCalledWith(expectCode, script);
		} finally {
			spyInstance.mockRestore();
		}
	});

	it('should support exec script with importEntry correctly(html object)', async () => {
		// arrange
		const spyInstance = jest.spyOn(console, 'log');
		spyInstance.mockImplementation(jest.fn());

		const afterExecHook = jest.fn();

		const dummyContext = {
			hello: 'world',
		};

		const expectCode = 'console.log(this.hello, window.hello)';
		const script = './html-object-script.js';

		const fetch = async () => ({
			text: async () => expectCode,
		});

		try {
			// act
			const result = await importEntry(
				{
					scripts: [script],
				},
				{
					fetch,
				}
			);

			await result.execScripts(dummyContext, true, {
				beforeExec(code, scriptSource) {
					expect(code).toBe(expectCode);
					expect(scriptSource).toBe(script);

					return 'console.log(this.hello, window.hello, "updated")';
				},
				afterExec: afterExecHook,
			});

			// assert
			expect(spyInstance).toHaveBeenCalledTimes(1);
			expect(spyInstance).toHaveBeenCalledWith('world', 'world', 'updated');
			expect(afterExecHook).toHaveBeenCalledWith(expectCode, script);
		} finally {
			spyInstance.mockRestore();
		}
	});
});
