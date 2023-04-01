import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "hamilton" is now active!');

	context.subscriptions.push(
		vscode.commands.registerCommand('hamilton.helloWorld', () => {
			vscode.window.showInformationMessage('Hello World from hamilton!');
		})
	);
}

export function deactivate() {}
