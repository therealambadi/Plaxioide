The product.json looks fine. The "app not opening at all" on Windows is almost certainly one of these causes:

Missing @vscode/windows-mutex native module — if npm ci didn't build it correctly, the mutex import fails silently and Electron crashes before showing any window
@vscode/deviceid windows.node is wrong architecture — it loads at startup on Windows and will crash immediately
Missing Electron binary or wrong arch — if the installer packaged x64 but the machine is ARM64
The Windows agent needs to run the app from the command line to see the crash. Tell them to run:


cd "C:\Program Files\Plaxio"
Plaxio.exe --log debug --no-sandbox 2>&1
Or if it's not installed yet, from the build folder:


..\VSCode-win32-x64\Plaxio.exe --log debug --no-sandbox
That will print the exact crash to the terminal. Without that output we're guessing. The most important thing the Windows agent needs to send back is that error output.
