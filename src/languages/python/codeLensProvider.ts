import { execFileSync } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

import { getBinPath } from '../../utils/pathUtils';

// Test function location item structure returned by `scripts/test_functions.py`.
interface TestFunctionLocation {
  id: string;
  line: number;
}

// Good enough heuristic.
const PYTHON_TEST_FILENAME_REGEX = /^(test_.+|.+_test)\.py$/;

export class PythonTestCodeLensProvider implements vscode.CodeLensProvider {
  private python3NotFoundMessageShown = false;

  public async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    if (!PYTHON_TEST_FILENAME_REGEX.test(document.fileName)) {
      return [];
    }

    return await this.getCodeLens(document, token);
  }

  private async getCodeLens(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    let testFunctionLocations: TestFunctionLocation[] = [];

    try {
      const python3 = getBinPath('python3');
      if (!python3) {
        if (!this.python3NotFoundMessageShown) {
          this.python3NotFoundMessageShown = true;
          vscode.window.showWarningMessage(
            'Could not find python3 required for adding all code lenses to BUILD files.'
          );
        }
      } else {
        const content = execFileSync(
          python3,
          [
            path.join(__dirname, '../../../scripts/test_functions.py'),
            document.fileName,
          ],
          { encoding: 'utf-8' }
        );
        testFunctionLocations = JSON.parse(content);
      }
    } catch (e) {
      vscode.window.showErrorMessage(e.message);
      return;
    }

    const firstLineRange = new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(0, 0)
    );

    let codeLens: vscode.CodeLens[] = [
      new vscode.CodeLens(firstLineRange, {
        title: 'plz test',
        command: 'plz.test.document',
        arguments: [{ document }],
      }),
      new vscode.CodeLens(firstLineRange, {
        title: 'plz debug',
        command: 'plz.debug.document',
        arguments: [{ document, language: 'python' }],
      }),
    ];

    for (const testFunctionLocation of testFunctionLocations) {
      const range = new vscode.Range(
        new vscode.Position(testFunctionLocation.line - 1, 0),
        new vscode.Position(testFunctionLocation.line - 1, 0)
      );

      codeLens = [
        ...codeLens,
        new vscode.CodeLens(range, {
          title: 'plz test',
          command: 'plz.test.document',
          arguments: [{ document, functionName: testFunctionLocation.id }],
        }),
        new vscode.CodeLens(range, {
          title: 'plz debug',
          command: 'plz.debug.document',
          arguments: [
            {
              document,
              functionName: testFunctionLocation.id,
              language: 'python',
            },
          ],
        }),
      ];
    }

    return codeLens;
  }
}
