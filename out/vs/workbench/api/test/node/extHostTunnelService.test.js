import assert from "assert";
import { findPorts, getRootProcesses, getSockets, loadConnectionTable, loadListeningPorts, parseIpAddress, tryFindRootPorts } from "../../node/extHostTunnelService.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
const tcp = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
	0: 00000000:0BBA 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 2335214 1 0000000010173312 100 0 0 10 0
	1: 00000000:1AF3 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 2334514 1 000000008815920b 100 0 0 10 0
	2: 0100007F:A9EA 0100007F:1AF3 01 00000000:00000000 00:00000000 00000000  1000        0 2334521 1 00000000a37d44c6 21 4 0 10 -1
	3: 0100007F:E8B4 0100007F:98EF 01 00000000:00000000 00:00000000 00000000  1000        0 2334532 1 0000000031b88f06 21 4 0 10 -1
	4: 0100007F:866C 0100007F:8783 01 00000000:00000000 00:00000000 00000000  1000        0 2334510 1 00000000cbf670bb 21 4 30 10 -1
	5: 0100007F:1AF3 0100007F:A9EA 01 00000000:00000000 00:00000000 00000000  1000        0 2338989 1 0000000000bace62 21 4 1 10 -1
`;
const tcp6 = `  sl  local_address                         remote_address                        st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
	0: 00000000000000000000000000000000:815B 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 2321070 1 00000000c44f3f02 100 0 0 10 0
	1: 00000000000000000000000000000000:8783 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 2334509 1 000000003915e812 100 0 0 10 0
	2: 00000000000000000000000000000000:9907 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 2284465 1 00000000f13b9374 100 0 0 10 0
	3: 00000000000000000000000000000000:98EF 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 2334531 1 00000000184cae9c 100 0 0 10 0
	4: 00000000000000000000000000000000:8BCF 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 2329890 1 00000000c05a3466 100 0 0 10 0
	5: 0000000000000000FFFF00000100007F:8783 0000000000000000FFFF00000100007F:866C 01 00000000:00000000 00:00000000 00000000  1000        0 2334511 1 00000000bf547132 21 4 1 10 -1
	6: 0000000000000000FFFF00000100007F:98EF 0000000000000000FFFF00000100007F:E8B4 01 00000000:00000000 00:00000000 00000000  1000        0 2334533 1 0000000039d0bcd2 21 4 1 10 -1
	7: 0000000000000000FFFF0000DFD317AC:9907 0000000000000000FFFF000001D017AC:C123 01 0000005A:00000000 01:00000017 00000000  1000        0 2311039 3 0000000067b6c8db 23 5 25 10 52
	8: 0000000000000000FFFF0000DFD317AC:9907 0000000000000000FFFF000001D017AC:C124 01 00000000:00000000 00:00000000 00000000  1000        0 2311040 1 00000000230bb017 25 4 30 10 28
	9: 0000000000000000FFFF0000DFD317AC:9907 0000000000000000FFFF000001D017AC:C213 01 00000000:00000000 00:00000000 00000000  1000        0 2331501 1 00000000957fcb4a 26 4 30 10 57
	10: 0000000000000000FFFF0000DFD317AC:9907 0000000000000000FFFF000001D017AC:C214 01 00000000:00000000 00:00000000 00000000  1000        0 2331500 1 00000000d7f87ceb 25 4 28 10 -1
`;
const procSockets = `ls: cannot access '/proc/8289/fd/255': No such file or directory
			ls: cannot access '/proc/8289/fd/3': No such file or directory
			lrwx------ 1 alex alex 64 Dec  8 14:59 /proc/230/fd/3 -> socket:[21862]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/0 -> socket:[2311043]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/1 -> socket:[2311045]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/19 -> socket:[2311040]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/2 -> socket:[2311047]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/20 -> socket:[2314928]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/22 -> socket:[2307042]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/24 -> socket:[2307051]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/25 -> socket:[2307044]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/27 -> socket:[2307046]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/29 -> socket:[2307053]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/3 -> socket:[2311049]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/30 -> socket:[2307048]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/32 -> socket:[2307055]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/33 -> socket:[2307067]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/34 -> socket:[2307057]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/35 -> socket:[2321483]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/37 -> socket:[2321070]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/41 -> socket:[2321485]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/42 -> socket:[2321074]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/43 -> socket:[2321487]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/44 -> socket:[2329890]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/45 -> socket:[2321489]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2504/fd/46 -> socket:[2334509]
			lrwx------ 1 alex alex 64 Dec  8 15:17 /proc/2504/fd/47 -> socket:[2334510]
			lrwx------ 1 alex alex 64 Dec  8 15:17 /proc/2504/fd/48 -> socket:[2329894]
			lrwx------ 1 alex alex 64 Dec  8 15:17 /proc/2504/fd/49 -> socket:[2334511]
			lrwx------ 1 alex alex 64 Dec  8 15:17 /proc/2504/fd/50 -> socket:[2334515]
			lrwx------ 1 alex alex 64 Dec  8 15:17 /proc/2504/fd/51 -> socket:[2334519]
			lrwx------ 1 alex alex 64 Dec  8 15:17 /proc/2504/fd/52 -> socket:[2334518]
			lrwx------ 1 alex alex 64 Dec  8 15:17 /proc/2504/fd/53 -> socket:[2334521]
			lrwx------ 1 alex alex 64 Dec  8 15:17 /proc/2504/fd/54 -> socket:[2334531]
			lrwx------ 1 alex alex 64 Dec  8 15:17 /proc/2504/fd/55 -> socket:[2334532]
			lrwx------ 1 alex alex 64 Dec  8 15:17 /proc/2504/fd/56 -> socket:[2334533]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2515/fd/3 -> socket:[2311053]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2719/fd/0 -> socket:[2307043]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2719/fd/1 -> socket:[2307045]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2719/fd/2 -> socket:[2307047]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2719/fd/3 -> socket:[2307049]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2725/fd/0 -> socket:[2307052]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2725/fd/1 -> socket:[2307054]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2725/fd/2 -> socket:[2307056]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2725/fd/20 -> socket:[2290617]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2725/fd/3 -> socket:[2307058]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2739/fd/0 -> socket:[2307052]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2739/fd/1 -> socket:[2307054]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2739/fd/2 -> socket:[2307056]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2739/fd/3 -> socket:[2290618]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2795/fd/0 -> socket:[2321484]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2795/fd/1 -> socket:[2321486]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2795/fd/2 -> socket:[2321488]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/2795/fd/3 -> socket:[2321490]
			lrwx------ 1 alex alex 64 Dec  8 14:59 /proc/314/fd/18 -> socket:[2284465]
			lrwx------ 1 alex alex 64 Dec  8 14:59 /proc/314/fd/19 -> socket:[2311039]
			lrwx------ 1 alex alex 64 Dec  8 14:59 /proc/314/fd/23 -> socket:[2331501]
			lrwx------ 1 alex alex 64 Dec  8 14:59 /proc/314/fd/24 -> socket:[2311052]
			lrwx------ 1 alex alex 64 Dec  8 14:59 /proc/314/fd/25 -> socket:[2311042]
			lrwx------ 1 alex alex 64 Dec  8 14:59 /proc/314/fd/26 -> socket:[2331504]
			lrwx------ 1 alex alex 64 Dec  8 14:59 /proc/314/fd/27 -> socket:[2311051]
			lrwx------ 1 alex alex 64 Dec  8 14:59 /proc/314/fd/29 -> socket:[2311044]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/314/fd/30 -> socket:[2321909]
			lrwx------ 1 alex alex 64 Dec  8 14:59 /proc/314/fd/31 -> socket:[2311046]
			lrwx------ 1 alex alex 64 Dec  8 15:14 /proc/314/fd/33 -> socket:[2311048]
			lrwx------ 1 alex alex 64 Dec  8 15:17 /proc/314/fd/35 -> socket:[2329692]
			lrwx------ 1 alex alex 64 Dec  8 15:17 /proc/314/fd/37 -> socket:[2331506]
			lrwx------ 1 alex alex 64 Dec  8 15:20 /proc/314/fd/40 -> socket:[2331508]
			lrwx------ 1 alex alex 64 Dec  8 15:20 /proc/314/fd/42 -> socket:[2331510]
			lrwx------ 1 alex alex 64 Dec  8 15:17 /proc/314/fd/68 -> socket:[2322083]
			lrwx------ 1 alex alex 64 Dec  8 15:22 /proc/4412/fd/20 -> socket:[2335214]
			lrwx------ 1 alex alex 64 Dec  8 15:22 /proc/4496/fd/0 -> socket:[2331505]
			lrwx------ 1 alex alex 64 Dec  8 15:22 /proc/4496/fd/1 -> socket:[2331507]
			lrwx------ 1 alex alex 64 Dec  8 15:22 /proc/4496/fd/2 -> socket:[2331509]
			lrwx------ 1 alex alex 64 Dec  8 15:22 /proc/4496/fd/23 -> socket:[2334514]
			lrwx------ 1 alex alex 64 Dec  8 15:22 /proc/4496/fd/24 -> socket:[2338989]
			lrwx------ 1 alex alex 64 Dec  8 15:22 /proc/4496/fd/26 -> socket:[2338276]
			lrwx------ 1 alex alex 64 Dec  8 15:22 /proc/4496/fd/27 -> socket:[2331500]
			lrwx------ 1 alex alex 64 Dec  8 15:22 /proc/4496/fd/3 -> socket:[2331511]
			lrwx------ 1 alex alex 64 Dec  8 15:22 /proc/4496/fd/31 -> socket:[2338285]`;
const processes = [
  {
    pid: 230,
    cwd: "/mnt/c/WINDOWS/system32",
    cmd: "dockerserve--addressunix:///home/alex/.docker/run/docker-cli-api.sock"
  },
  {
    pid: 2504,
    cwd: "/mnt/c/Users/alros/AppData/Local/Programs/Microsoft VS Code Insiders",
    cmd: "/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/node/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/out/bootstrap-fork--type=extensionHost--transformURIs--useHostProxy="
  },
  {
    pid: 2515,
    cwd: "/mnt/c/Users/alros/AppData/Local/Programs/Microsoft VS Code Insiders",
    cmd: "/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/node/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/out/bootstrap-fork--type=watcherService"
  },
  {
    pid: 2526,
    cwd: "/home/alex/repos/Microsoft/vscode-extension-samples/helloworld-sample",
    cmd: "/bin/bash"
  },
  {
    pid: 2719,
    cwd: "/mnt/c/Users/alros/AppData/Local/Programs/Microsoft VS Code Insiders",
    cmd: "/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/node--max-old-space-size=3072/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/extensions/node_modules/typescript/lib/tsserver.js--serverModepartialSemantic--useInferredProjectPerProjectRoot--disableAutomaticTypingAcquisition--cancellationPipeName/tmp/vscode-typescript1000/7cfa7171c0c00aacf1ee/tscancellation-602cd80b954818b6a2f7.tmp*--logVerbosityverbose--logFile/home/alex/.vscode-server-insiders/data/logs/20201208T145954/exthost2/vscode.typescript-language-features/tsserver-log-nxBt2m/tsserver.log--globalPluginstypescript-vscode-sh-plugin--pluginProbeLocations/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/extensions/typescript-language-features--localeen--noGetErrOnBackgroundUpdate--validateDefaultNpmLocation"
  },
  {
    pid: 2725,
    cwd: "/mnt/c/Users/alros/AppData/Local/Programs/Microsoft VS Code Insiders",
    cmd: "/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/node--max-old-space-size=3072/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/extensions/node_modules/typescript/lib/tsserver.js--useInferredProjectPerProjectRoot--enableTelemetry--cancellationPipeName/tmp/vscode-typescript1000/7cfa7171c0c00aacf1ee/tscancellation-04a0b92f880c2fd535ae.tmp*--logVerbosityverbose--logFile/home/alex/.vscode-server-insiders/data/logs/20201208T145954/exthost2/vscode.typescript-language-features/tsserver-log-fqyBrs/tsserver.log--globalPluginstypescript-vscode-sh-plugin--pluginProbeLocations/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/extensions/typescript-language-features--localeen--noGetErrOnBackgroundUpdate--validateDefaultNpmLocation"
  },
  {
    pid: 2739,
    cwd: "/mnt/c/Users/alros/AppData/Local/Programs/Microsoft VS Code Insiders",
    cmd: "/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/node/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/extensions/node_modules/typescript/lib/typingsInstaller.js--globalTypingsCacheLocation/home/alex/.cache/typescript/4.1--enableTelemetry--logFile/home/alex/.vscode-server-insiders/data/logs/20201208T145954/exthost2/vscode.typescript-language-features/tsserver-log-fqyBrs/ti-2725.log--typesMapLocation/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/extensions/node_modules/typescript/lib/typesMap.json--validateDefaultNpmLocation"
  },
  {
    pid: 2795,
    cwd: "/home/alex/repos/Microsoft/vscode-extension-samples/helloworld-sample",
    cmd: "/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/node/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/extensions/json-language-features/server/dist/node/jsonServerMain--node-ipc--clientProcessId=2504"
  },
  {
    pid: 286,
    cwd: "/mnt/c/Users/alros/AppData/Local/Programs/Microsoft VS Code Insiders",
    cmd: 'sh-c"$VSCODE_WSL_EXT_LOCATION/ scripts / wslServer.sh" bc13785d3dd99b4b0e9da9aed17bb79809a50804 insider .vscode-server-insiders 0  '
  },
  {
    pid: 287,
    cwd: "/mnt/c/Users/alros/AppData/Local/Programs/Microsoft VS Code Insiders",
    cmd: "sh/mnt/c/Users/alros/.vscode-insiders/extensions/ms-vscode-remote.remote-wsl-0.52.0/scripts/wslServer.shbc13785d3dd99b4b0e9da9aed17bb79809a50804insider.vscode-server-insiders0"
  },
  {
    pid: 3058,
    cwd: "/home/alex/repos/Microsoft/vscode-extension-samples/helloworld-sample",
    cmd: "npm"
  },
  {
    pid: 3070,
    cwd: "/home/alex/repos/Microsoft/vscode-extension-samples/helloworld-sample",
    cmd: "sh-ctsc -watch -p ./"
  },
  {
    pid: 3071,
    cwd: "/home/alex/repos/Microsoft/vscode-extension-samples/helloworld-sample",
    cmd: "node/home/alex/repos/Microsoft/vscode-extension-samples/helloworld-sample/node_modules/.bin/tsc-watch-p./"
  },
  {
    pid: 312,
    cwd: "/mnt/c/Users/alros/AppData/Local/Programs/Microsoft VS Code Insiders",
    cmd: "sh/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/server.sh--port=0--use-host-proxy--enable-remote-auto-shutdown--print-ip-address"
  },
  {
    pid: 314,
    cwd: "/mnt/c/Users/alros/AppData/Local/Programs/Microsoft VS Code Insiders",
    cmd: "/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/node/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/out/server-main.js--port=0--use-host-proxy--enable-remote-auto-shutdown--print-ip-address"
  },
  {
    pid: 3172,
    cwd: "/home/alex",
    cmd: "/bin/bash"
  },
  {
    pid: 3610,
    cwd: "/home/alex/repos/Microsoft/vscode-extension-samples/helloworld-sample",
    cmd: "/bin/bash"
  },
  {
    pid: 4412,
    cwd: "/home/alex/repos/Microsoft/vscode-extension-samples/helloworld-sample",
    cmd: "http-server"
  },
  {
    pid: 4496,
    cwd: "/mnt/c/Users/alros/AppData/Local/Programs/Microsoft VS Code Insiders",
    cmd: "/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/node--inspect-brk=0.0.0.0:6899/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/out/bootstrap-fork--type=extensionHost--transformURIs--useHostProxy="
  },
  {
    pid: 4507,
    cwd: "/mnt/c/Users/alros/AppData/Local/Programs/Microsoft VS Code Insiders",
    cmd: "/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/node/home/alex/.vscode-server-insiders/bin/bc13785d3dd99b4b0e9da9aed17bb79809a50804/extensions/ms-vscode.js-debug/src/hash.bundle.js"
  }
];
const psStdOut = `4 S root         1     0  0  80   0 -   596 -       1440   2 14:41 ?        00:00:00 /bin/sh -c echo Container started ; trap "exit 0" 15; while sleep 1 & wait $!; do :; done
4 S root        14     0  0  80   0 -   596 -        764   4 14:41 ?        00:00:00 /bin/sh
4 S root        40     0  0  80   0 -   596 -        700   4 14:41 ?        00:00:00 /bin/sh
4 S root       513   380  0  80   0 -  2476 -       3404   1 14:41 pts/1    00:00:00 sudo npx http-server -p 5000
4 S root       514   513  0  80   0 - 165439 -     41380   5 14:41 pts/1    00:00:00 http-server
0 S root      1052     1  0  80   0 -   573 -        752   5 14:43 ?        00:00:00 sleep 1
0 S node      1056   329  0  80   0 -   596 do_wai   764  10 14:43 ?        00:00:00 /bin/sh -c ps -F -A -l | grep root
0 S node      1058  1056  0  80   0 -   770 pipe_w   888   9 14:43 ?        00:00:00 grep root`;
suite("ExtHostTunnelService", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("getSockets", function() {
    const result = getSockets(procSockets);
    assert.strictEqual(Object.keys(result).length, 75);
    assert.notStrictEqual(Object.keys(result).find((key) => result[key].pid === 4412), void 0);
  });
  test("loadConnectionTable", function() {
    const result = loadConnectionTable(tcp);
    assert.strictEqual(result.length, 6);
    assert.deepStrictEqual(result[0], {
      10: "1",
      11: "0000000010173312",
      12: "100",
      13: "0",
      14: "0",
      15: "10",
      16: "0",
      inode: "2335214",
      local_address: "00000000:0BBA",
      rem_address: "00000000:0000",
      retrnsmt: "00000000",
      sl: "0:",
      st: "0A",
      timeout: "0",
      tr: "00:00000000",
      tx_queue: "00000000:00000000",
      uid: "1000"
    });
  });
  test("loadListeningPorts", function() {
    const result = loadListeningPorts(tcp, tcp6);
    assert.strictEqual(result.length, 7);
    assert.notStrictEqual(result.find((value) => value.port === 3002), void 0);
  });
  test("tryFindRootPorts", function() {
    const rootProcesses = getRootProcesses(psStdOut);
    assert.strictEqual(rootProcesses.length, 6);
    const result = tryFindRootPorts([{ socket: 1e3, ip: "127.0.0.1", port: 5e3 }], psStdOut, /* @__PURE__ */ new Map());
    assert.strictEqual(result.size, 1);
    assert.strictEqual(result.get(5e3)?.pid, 514);
  });
  test("findPorts", async function() {
    const result = await findPorts(loadListeningPorts(tcp, tcp6), getSockets(procSockets), processes);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].host, "0.0.0.0");
    assert.strictEqual(result[0].port, 3002);
    assert.strictEqual(result[0].detail, "http-server");
  });
  test("parseIpAddress", function() {
    assert.strictEqual(parseIpAddress("00000000000000000000000001000000"), "0:0:0:0:0:0:0:1");
    assert.strictEqual(parseIpAddress("0000000000000000FFFF0000040510AC"), "0:0:0:0:0:ffff:ac10:504");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3Qvbm9kZS9leHRIb3N0VHVubmVsU2VydmljZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZmluZFBvcnRzLCBnZXRSb290UHJvY2Vzc2VzLCBnZXRTb2NrZXRzLCBsb2FkQ29ubmVjdGlvblRhYmxlLCBsb2FkTGlzdGVuaW5nUG9ydHMsIHBhcnNlSXBBZGRyZXNzLCB0cnlGaW5kUm9vdFBvcnRzIH0gZnJvbSAnLi4vLi4vbm9kZS9leHRIb3N0VHVubmVsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcblxuY29uc3QgdGNwID1cblx0YCAgc2wgIGxvY2FsX2FkZHJlc3MgcmVtX2FkZHJlc3MgICBzdCB0eF9xdWV1ZSByeF9xdWV1ZSB0ciB0bS0+d2hlbiByZXRybnNtdCAgIHVpZCAgdGltZW91dCBpbm9kZVxuXHQwOiAwMDAwMDAwMDowQkJBIDAwMDAwMDAwOjAwMDAgMEEgMDAwMDAwMDA6MDAwMDAwMDAgMDA6MDAwMDAwMDAgMDAwMDAwMDAgIDEwMDAgICAgICAgIDAgMjMzNTIxNCAxIDAwMDAwMDAwMTAxNzMzMTIgMTAwIDAgMCAxMCAwXG5cdDE6IDAwMDAwMDAwOjFBRjMgMDAwMDAwMDA6MDAwMCAwQSAwMDAwMDAwMDowMDAwMDAwMCAwMDowMDAwMDAwMCAwMDAwMDAwMCAgMTAwMCAgICAgICAgMCAyMzM0NTE0IDEgMDAwMDAwMDA4ODE1OTIwYiAxMDAgMCAwIDEwIDBcblx0MjogMDEwMDAwN0Y6QTlFQSAwMTAwMDA3RjoxQUYzIDAxIDAwMDAwMDAwOjAwMDAwMDAwIDAwOjAwMDAwMDAwIDAwMDAwMDAwICAxMDAwICAgICAgICAwIDIzMzQ1MjEgMSAwMDAwMDAwMGEzN2Q0NGM2IDIxIDQgMCAxMCAtMVxuXHQzOiAwMTAwMDA3RjpFOEI0IDAxMDAwMDdGOjk4RUYgMDEgMDAwMDAwMDA6MDAwMDAwMDAgMDA6MDAwMDAwMDAgMDAwMDAwMDAgIDEwMDAgICAgICAgIDAgMjMzNDUzMiAxIDAwMDAwMDAwMzFiODhmMDYgMjEgNCAwIDEwIC0xXG5cdDQ6IDAxMDAwMDdGOjg2NkMgMDEwMDAwN0Y6ODc4MyAwMSAwMDAwMDAwMDowMDAwMDAwMCAwMDowMDAwMDAwMCAwMDAwMDAwMCAgMTAwMCAgICAgICAgMCAyMzM0NTEwIDEgMDAwMDAwMDBjYmY2NzBiYiAyMSA0IDMwIDEwIC0xXG5cdDU6IDAxMDAwMDdGOjFBRjMgMDEwMDAwN0Y6QTlFQSAwMSAwMDAwMDAwMDowMDAwMDAwMCAwMDowMDAwMDAwMCAwMDAwMDAwMCAgMTAwMCAgICAgICAgMCAyMzM4OTg5IDEgMDAwMDAwMDAwMGJhY2U2MiAyMSA0IDEgMTAgLTFcbmA7XG5jb25zdCB0Y3A2ID1cblx0YCAgc2wgIGxvY2FsX2FkZHJlc3MgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3RlX2FkZHJlc3MgICAgICAgICAgICAgICAgICAgICAgICBzdCB0eF9xdWV1ZSByeF9xdWV1ZSB0ciB0bS0+d2hlbiByZXRybnNtdCAgIHVpZCAgdGltZW91dCBpbm9kZVxuXHQwOiAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDo4MTVCIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwOjAwMDAgMEEgMDAwMDAwMDA6MDAwMDAwMDAgMDA6MDAwMDAwMDAgMDAwMDAwMDAgIDEwMDAgICAgICAgIDAgMjMyMTA3MCAxIDAwMDAwMDAwYzQ0ZjNmMDIgMTAwIDAgMCAxMCAwXG5cdDE6IDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwOjg3ODMgMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA6MDAwMCAwQSAwMDAwMDAwMDowMDAwMDAwMCAwMDowMDAwMDAwMCAwMDAwMDAwMCAgMTAwMCAgICAgICAgMCAyMzM0NTA5IDEgMDAwMDAwMDAzOTE1ZTgxMiAxMDAgMCAwIDEwIDBcblx0MjogMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA6OTkwNyAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDowMDAwIDBBIDAwMDAwMDAwOjAwMDAwMDAwIDAwOjAwMDAwMDAwIDAwMDAwMDAwICAxMDAwICAgICAgICAwIDIyODQ0NjUgMSAwMDAwMDAwMGYxM2I5Mzc0IDEwMCAwIDAgMTAgMFxuXHQzOiAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDo5OEVGIDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwOjAwMDAgMEEgMDAwMDAwMDA6MDAwMDAwMDAgMDA6MDAwMDAwMDAgMDAwMDAwMDAgIDEwMDAgICAgICAgIDAgMjMzNDUzMSAxIDAwMDAwMDAwMTg0Y2FlOWMgMTAwIDAgMCAxMCAwXG5cdDQ6IDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwOjhCQ0YgMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA6MDAwMCAwQSAwMDAwMDAwMDowMDAwMDAwMCAwMDowMDAwMDAwMCAwMDAwMDAwMCAgMTAwMCAgICAgICAgMCAyMzI5ODkwIDEgMDAwMDAwMDBjMDVhMzQ2NiAxMDAgMCAwIDEwIDBcblx0NTogMDAwMDAwMDAwMDAwMDAwMEZGRkYwMDAwMDEwMDAwN0Y6ODc4MyAwMDAwMDAwMDAwMDAwMDAwRkZGRjAwMDAwMTAwMDA3Rjo4NjZDIDAxIDAwMDAwMDAwOjAwMDAwMDAwIDAwOjAwMDAwMDAwIDAwMDAwMDAwICAxMDAwICAgICAgICAwIDIzMzQ1MTEgMSAwMDAwMDAwMGJmNTQ3MTMyIDIxIDQgMSAxMCAtMVxuXHQ2OiAwMDAwMDAwMDAwMDAwMDAwRkZGRjAwMDAwMTAwMDA3Rjo5OEVGIDAwMDAwMDAwMDAwMDAwMDBGRkZGMDAwMDAxMDAwMDdGOkU4QjQgMDEgMDAwMDAwMDA6MDAwMDAwMDAgMDA6MDAwMDAwMDAgMDAwMDAwMDAgIDEwMDAgICAgICAgIDAgMjMzNDUzMyAxIDAwMDAwMDAwMzlkMGJjZDIgMjEgNCAxIDEwIC0xXG5cdDc6IDAwMDAwMDAwMDAwMDAwMDBGRkZGMDAwMERGRDMxN0FDOjk5MDcgMDAwMDAwMDAwMDAwMDAwMEZGRkYwMDAwMDFEMDE3QUM6QzEyMyAwMSAwMDAwMDA1QTowMDAwMDAwMCAwMTowMDAwMDAxNyAwMDAwMDAwMCAgMTAwMCAgICAgICAgMCAyMzExMDM5IDMgMDAwMDAwMDA2N2I2YzhkYiAyMyA1IDI1IDEwIDUyXG5cdDg6IDAwMDAwMDAwMDAwMDAwMDBGRkZGMDAwMERGRDMxN0FDOjk5MDcgMDAwMDAwMDAwMDAwMDAwMEZGRkYwMDAwMDFEMDE3QUM6QzEyNCAwMSAwMDAwMDAwMDowMDAwMDAwMCAwMDowMDAwMDAwMCAwMDAwMDAwMCAgMTAwMCAgICAgICAgMCAyMzExMDQwIDEgMDAwMDAwMDAyMzBiYjAxNyAyNSA0IDMwIDEwIDI4XG5cdDk6IDAwMDAwMDAwMDAwMDAwMDBGRkZGMDAwMERGRDMxN0FDOjk5MDcgMDAwMDAwMDAwMDAwMDAwMEZGRkYwMDAwMDFEMDE3QUM6QzIxMyAwMSAwMDAwMDAwMDowMDAwMDAwMCAwMDowMDAwMDAwMCAwMDAwMDAwMCAgMTAwMCAgICAgICAgMCAyMzMxNTAxIDEgMDAwMDAwMDA5NTdmY2I0YSAyNiA0IDMwIDEwIDU3XG5cdDEwOiAwMDAwMDAwMDAwMDAwMDAwRkZGRjAwMDBERkQzMTdBQzo5OTA3IDAwMDAwMDAwMDAwMDAwMDBGRkZGMDAwMDAxRDAxN0FDOkMyMTQgMDEgMDAwMDAwMDA6MDAwMDAwMDAgMDA6MDAwMDAwMDAgMDAwMDAwMDAgIDEwMDAgICAgICAgIDAgMjMzMTUwMCAxIDAwMDAwMDAwZDdmODdjZWIgMjUgNCAyOCAxMCAtMVxuYDtcblxuY29uc3QgcHJvY1NvY2tldHMgPVxuXHRgbHM6IGNhbm5vdCBhY2Nlc3MgJy9wcm9jLzgyODkvZmQvMjU1JzogTm8gc3VjaCBmaWxlIG9yIGRpcmVjdG9yeVxuXHRcdFx0bHM6IGNhbm5vdCBhY2Nlc3MgJy9wcm9jLzgyODkvZmQvMyc6IE5vIHN1Y2ggZmlsZSBvciBkaXJlY3Rvcnlcblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE0OjU5IC9wcm9jLzIzMC9mZC8zIC0+IHNvY2tldDpbMjE4NjJdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNCAvcHJvYy8yNTA0L2ZkLzAgLT4gc29ja2V0OlsyMzExMDQzXVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTQgL3Byb2MvMjUwNC9mZC8xIC0+IHNvY2tldDpbMjMxMTA0NV1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE0IC9wcm9jLzI1MDQvZmQvMTkgLT4gc29ja2V0OlsyMzExMDQwXVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTQgL3Byb2MvMjUwNC9mZC8yIC0+IHNvY2tldDpbMjMxMTA0N11cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE0IC9wcm9jLzI1MDQvZmQvMjAgLT4gc29ja2V0OlsyMzE0OTI4XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTQgL3Byb2MvMjUwNC9mZC8yMiAtPiBzb2NrZXQ6WzIzMDcwNDJdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNCAvcHJvYy8yNTA0L2ZkLzI0IC0+IHNvY2tldDpbMjMwNzA1MV1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE0IC9wcm9jLzI1MDQvZmQvMjUgLT4gc29ja2V0OlsyMzA3MDQ0XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTQgL3Byb2MvMjUwNC9mZC8yNyAtPiBzb2NrZXQ6WzIzMDcwNDZdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNCAvcHJvYy8yNTA0L2ZkLzI5IC0+IHNvY2tldDpbMjMwNzA1M11cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE0IC9wcm9jLzI1MDQvZmQvMyAtPiBzb2NrZXQ6WzIzMTEwNDldXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNCAvcHJvYy8yNTA0L2ZkLzMwIC0+IHNvY2tldDpbMjMwNzA0OF1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE0IC9wcm9jLzI1MDQvZmQvMzIgLT4gc29ja2V0OlsyMzA3MDU1XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTQgL3Byb2MvMjUwNC9mZC8zMyAtPiBzb2NrZXQ6WzIzMDcwNjddXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNCAvcHJvYy8yNTA0L2ZkLzM0IC0+IHNvY2tldDpbMjMwNzA1N11cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE0IC9wcm9jLzI1MDQvZmQvMzUgLT4gc29ja2V0OlsyMzIxNDgzXVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTQgL3Byb2MvMjUwNC9mZC8zNyAtPiBzb2NrZXQ6WzIzMjEwNzBdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNCAvcHJvYy8yNTA0L2ZkLzQxIC0+IHNvY2tldDpbMjMyMTQ4NV1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE0IC9wcm9jLzI1MDQvZmQvNDIgLT4gc29ja2V0OlsyMzIxMDc0XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTQgL3Byb2MvMjUwNC9mZC80MyAtPiBzb2NrZXQ6WzIzMjE0ODddXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNCAvcHJvYy8yNTA0L2ZkLzQ0IC0+IHNvY2tldDpbMjMyOTg5MF1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE0IC9wcm9jLzI1MDQvZmQvNDUgLT4gc29ja2V0OlsyMzIxNDg5XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTQgL3Byb2MvMjUwNC9mZC80NiAtPiBzb2NrZXQ6WzIzMzQ1MDldXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNyAvcHJvYy8yNTA0L2ZkLzQ3IC0+IHNvY2tldDpbMjMzNDUxMF1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE3IC9wcm9jLzI1MDQvZmQvNDggLT4gc29ja2V0OlsyMzI5ODk0XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTcgL3Byb2MvMjUwNC9mZC80OSAtPiBzb2NrZXQ6WzIzMzQ1MTFdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNyAvcHJvYy8yNTA0L2ZkLzUwIC0+IHNvY2tldDpbMjMzNDUxNV1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE3IC9wcm9jLzI1MDQvZmQvNTEgLT4gc29ja2V0OlsyMzM0NTE5XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTcgL3Byb2MvMjUwNC9mZC81MiAtPiBzb2NrZXQ6WzIzMzQ1MThdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNyAvcHJvYy8yNTA0L2ZkLzUzIC0+IHNvY2tldDpbMjMzNDUyMV1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE3IC9wcm9jLzI1MDQvZmQvNTQgLT4gc29ja2V0OlsyMzM0NTMxXVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTcgL3Byb2MvMjUwNC9mZC81NSAtPiBzb2NrZXQ6WzIzMzQ1MzJdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNyAvcHJvYy8yNTA0L2ZkLzU2IC0+IHNvY2tldDpbMjMzNDUzM11cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE0IC9wcm9jLzI1MTUvZmQvMyAtPiBzb2NrZXQ6WzIzMTEwNTNdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNCAvcHJvYy8yNzE5L2ZkLzAgLT4gc29ja2V0OlsyMzA3MDQzXVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTQgL3Byb2MvMjcxOS9mZC8xIC0+IHNvY2tldDpbMjMwNzA0NV1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE0IC9wcm9jLzI3MTkvZmQvMiAtPiBzb2NrZXQ6WzIzMDcwNDddXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNCAvcHJvYy8yNzE5L2ZkLzMgLT4gc29ja2V0OlsyMzA3MDQ5XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTQgL3Byb2MvMjcyNS9mZC8wIC0+IHNvY2tldDpbMjMwNzA1Ml1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE0IC9wcm9jLzI3MjUvZmQvMSAtPiBzb2NrZXQ6WzIzMDcwNTRdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNCAvcHJvYy8yNzI1L2ZkLzIgLT4gc29ja2V0OlsyMzA3MDU2XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTQgL3Byb2MvMjcyNS9mZC8yMCAtPiBzb2NrZXQ6WzIyOTA2MTddXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNCAvcHJvYy8yNzI1L2ZkLzMgLT4gc29ja2V0OlsyMzA3MDU4XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTQgL3Byb2MvMjczOS9mZC8wIC0+IHNvY2tldDpbMjMwNzA1Ml1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE0IC9wcm9jLzI3MzkvZmQvMSAtPiBzb2NrZXQ6WzIzMDcwNTRdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNCAvcHJvYy8yNzM5L2ZkLzIgLT4gc29ja2V0OlsyMzA3MDU2XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTQgL3Byb2MvMjczOS9mZC8zIC0+IHNvY2tldDpbMjI5MDYxOF1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE0IC9wcm9jLzI3OTUvZmQvMCAtPiBzb2NrZXQ6WzIzMjE0ODRdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNCAvcHJvYy8yNzk1L2ZkLzEgLT4gc29ja2V0OlsyMzIxNDg2XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTQgL3Byb2MvMjc5NS9mZC8yIC0+IHNvY2tldDpbMjMyMTQ4OF1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE0IC9wcm9jLzI3OTUvZmQvMyAtPiBzb2NrZXQ6WzIzMjE0OTBdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNDo1OSAvcHJvYy8zMTQvZmQvMTggLT4gc29ja2V0OlsyMjg0NDY1XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTQ6NTkgL3Byb2MvMzE0L2ZkLzE5IC0+IHNvY2tldDpbMjMxMTAzOV1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE0OjU5IC9wcm9jLzMxNC9mZC8yMyAtPiBzb2NrZXQ6WzIzMzE1MDFdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNDo1OSAvcHJvYy8zMTQvZmQvMjQgLT4gc29ja2V0OlsyMzExMDUyXVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTQ6NTkgL3Byb2MvMzE0L2ZkLzI1IC0+IHNvY2tldDpbMjMxMTA0Ml1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE0OjU5IC9wcm9jLzMxNC9mZC8yNiAtPiBzb2NrZXQ6WzIzMzE1MDRdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNDo1OSAvcHJvYy8zMTQvZmQvMjcgLT4gc29ja2V0OlsyMzExMDUxXVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTQ6NTkgL3Byb2MvMzE0L2ZkLzI5IC0+IHNvY2tldDpbMjMxMTA0NF1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE0IC9wcm9jLzMxNC9mZC8zMCAtPiBzb2NrZXQ6WzIzMjE5MDldXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNDo1OSAvcHJvYy8zMTQvZmQvMzEgLT4gc29ja2V0OlsyMzExMDQ2XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MTQgL3Byb2MvMzE0L2ZkLzMzIC0+IHNvY2tldDpbMjMxMTA0OF1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjE3IC9wcm9jLzMxNC9mZC8zNSAtPiBzb2NrZXQ6WzIzMjk2OTJdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNyAvcHJvYy8zMTQvZmQvMzcgLT4gc29ja2V0OlsyMzMxNTA2XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MjAgL3Byb2MvMzE0L2ZkLzQwIC0+IHNvY2tldDpbMjMzMTUwOF1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjIwIC9wcm9jLzMxNC9mZC80MiAtPiBzb2NrZXQ6WzIzMzE1MTBdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToxNyAvcHJvYy8zMTQvZmQvNjggLT4gc29ja2V0OlsyMzIyMDgzXVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MjIgL3Byb2MvNDQxMi9mZC8yMCAtPiBzb2NrZXQ6WzIzMzUyMTRdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToyMiAvcHJvYy80NDk2L2ZkLzAgLT4gc29ja2V0OlsyMzMxNTA1XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MjIgL3Byb2MvNDQ5Ni9mZC8xIC0+IHNvY2tldDpbMjMzMTUwN11cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjIyIC9wcm9jLzQ0OTYvZmQvMiAtPiBzb2NrZXQ6WzIzMzE1MDldXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToyMiAvcHJvYy80NDk2L2ZkLzIzIC0+IHNvY2tldDpbMjMzNDUxNF1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjIyIC9wcm9jLzQ0OTYvZmQvMjQgLT4gc29ja2V0OlsyMzM4OTg5XVxuXHRcdFx0bHJ3eC0tLS0tLSAxIGFsZXggYWxleCA2NCBEZWMgIDggMTU6MjIgL3Byb2MvNDQ5Ni9mZC8yNiAtPiBzb2NrZXQ6WzIzMzgyNzZdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToyMiAvcHJvYy80NDk2L2ZkLzI3IC0+IHNvY2tldDpbMjMzMTUwMF1cblx0XHRcdGxyd3gtLS0tLS0gMSBhbGV4IGFsZXggNjQgRGVjICA4IDE1OjIyIC9wcm9jLzQ0OTYvZmQvMyAtPiBzb2NrZXQ6WzIzMzE1MTFdXG5cdFx0XHRscnd4LS0tLS0tIDEgYWxleCBhbGV4IDY0IERlYyAgOCAxNToyMiAvcHJvYy80NDk2L2ZkLzMxIC0+IHNvY2tldDpbMjMzODI4NV1gO1xuXG5jb25zdCBwcm9jZXNzZXM6IHsgcGlkOiBudW1iZXI7IGN3ZDogc3RyaW5nOyBjbWQ6IHN0cmluZyB9W10gPSBbXG5cdHtcblx0XHRwaWQ6IDIzMCxcblx0XHRjd2Q6ICcvbW50L2MvV0lORE9XUy9zeXN0ZW0zMicsXG5cdFx0Y21kOiAnZG9ja2Vyc2VydmUtLWFkZHJlc3N1bml4Oi8vL2hvbWUvYWxleC8uZG9ja2VyL3J1bi9kb2NrZXItY2xpLWFwaS5zb2NrJyxcblx0fSxcblx0e1xuXHRcdHBpZDogMjUwNCxcblx0XHRjd2Q6ICcvbW50L2MvVXNlcnMvYWxyb3MvQXBwRGF0YS9Mb2NhbC9Qcm9ncmFtcy9NaWNyb3NvZnQgVlMgQ29kZSBJbnNpZGVycycsXG5cdFx0Y21kOiAnL2hvbWUvYWxleC8udnNjb2RlLXNlcnZlci1pbnNpZGVycy9iaW4vYmMxMzc4NWQzZGQ5OWI0YjBlOWRhOWFlZDE3YmI3OTgwOWE1MDgwNC9ub2RlL2hvbWUvYWxleC8udnNjb2RlLXNlcnZlci1pbnNpZGVycy9iaW4vYmMxMzc4NWQzZGQ5OWI0YjBlOWRhOWFlZDE3YmI3OTgwOWE1MDgwNC9vdXQvYm9vdHN0cmFwLWZvcmstLXR5cGU9ZXh0ZW5zaW9uSG9zdC0tdHJhbnNmb3JtVVJJcy0tdXNlSG9zdFByb3h5PScsXG5cdH0sXG5cdHtcblx0XHRwaWQ6IDI1MTUsXG5cdFx0Y3dkOiAnL21udC9jL1VzZXJzL2Fscm9zL0FwcERhdGEvTG9jYWwvUHJvZ3JhbXMvTWljcm9zb2Z0IFZTIENvZGUgSW5zaWRlcnMnLFxuXHRcdGNtZDogJy9ob21lL2FsZXgvLnZzY29kZS1zZXJ2ZXItaW5zaWRlcnMvYmluL2JjMTM3ODVkM2RkOTliNGIwZTlkYTlhZWQxN2JiNzk4MDlhNTA4MDQvbm9kZS9ob21lL2FsZXgvLnZzY29kZS1zZXJ2ZXItaW5zaWRlcnMvYmluL2JjMTM3ODVkM2RkOTliNGIwZTlkYTlhZWQxN2JiNzk4MDlhNTA4MDQvb3V0L2Jvb3RzdHJhcC1mb3JrLS10eXBlPXdhdGNoZXJTZXJ2aWNlJ1xuXHR9LFxuXHR7XG5cdFx0cGlkOiAyNTI2LFxuXHRcdGN3ZDogJy9ob21lL2FsZXgvcmVwb3MvTWljcm9zb2Z0L3ZzY29kZS1leHRlbnNpb24tc2FtcGxlcy9oZWxsb3dvcmxkLXNhbXBsZScsXG5cdFx0Y21kOiAnL2Jpbi9iYXNoJ1xuXHR9LCB7XG5cdFx0cGlkOiAyNzE5LFxuXHRcdGN3ZDogJy9tbnQvYy9Vc2Vycy9hbHJvcy9BcHBEYXRhL0xvY2FsL1Byb2dyYW1zL01pY3Jvc29mdCBWUyBDb2RlIEluc2lkZXJzJyxcblx0XHRjbWQ6ICcvaG9tZS9hbGV4Ly52c2NvZGUtc2VydmVyLWluc2lkZXJzL2Jpbi9iYzEzNzg1ZDNkZDk5YjRiMGU5ZGE5YWVkMTdiYjc5ODA5YTUwODA0L25vZGUtLW1heC1vbGQtc3BhY2Utc2l6ZT0zMDcyL2hvbWUvYWxleC8udnNjb2RlLXNlcnZlci1pbnNpZGVycy9iaW4vYmMxMzc4NWQzZGQ5OWI0YjBlOWRhOWFlZDE3YmI3OTgwOWE1MDgwNC9leHRlbnNpb25zL25vZGVfbW9kdWxlcy90eXBlc2NyaXB0L2xpYi90c3NlcnZlci5qcy0tc2VydmVyTW9kZXBhcnRpYWxTZW1hbnRpYy0tdXNlSW5mZXJyZWRQcm9qZWN0UGVyUHJvamVjdFJvb3QtLWRpc2FibGVBdXRvbWF0aWNUeXBpbmdBY3F1aXNpdGlvbi0tY2FuY2VsbGF0aW9uUGlwZU5hbWUvdG1wL3ZzY29kZS10eXBlc2NyaXB0MTAwMC83Y2ZhNzE3MWMwYzAwYWFjZjFlZS90c2NhbmNlbGxhdGlvbi02MDJjZDgwYjk1NDgxOGI2YTJmNy50bXAqLS1sb2dWZXJib3NpdHl2ZXJib3NlLS1sb2dGaWxlL2hvbWUvYWxleC8udnNjb2RlLXNlcnZlci1pbnNpZGVycy9kYXRhL2xvZ3MvMjAyMDEyMDhUMTQ1OTU0L2V4dGhvc3QyL3ZzY29kZS50eXBlc2NyaXB0LWxhbmd1YWdlLWZlYXR1cmVzL3Rzc2VydmVyLWxvZy1ueEJ0Mm0vdHNzZXJ2ZXIubG9nLS1nbG9iYWxQbHVnaW5zdHlwZXNjcmlwdC12c2NvZGUtc2gtcGx1Z2luLS1wbHVnaW5Qcm9iZUxvY2F0aW9ucy9ob21lL2FsZXgvLnZzY29kZS1zZXJ2ZXItaW5zaWRlcnMvYmluL2JjMTM3ODVkM2RkOTliNGIwZTlkYTlhZWQxN2JiNzk4MDlhNTA4MDQvZXh0ZW5zaW9ucy90eXBlc2NyaXB0LWxhbmd1YWdlLWZlYXR1cmVzLS1sb2NhbGVlbi0tbm9HZXRFcnJPbkJhY2tncm91bmRVcGRhdGUtLXZhbGlkYXRlRGVmYXVsdE5wbUxvY2F0aW9uJ1xuXHR9LFxuXHR7XG5cdFx0cGlkOiAyNzI1LFxuXHRcdGN3ZDogJy9tbnQvYy9Vc2Vycy9hbHJvcy9BcHBEYXRhL0xvY2FsL1Byb2dyYW1zL01pY3Jvc29mdCBWUyBDb2RlIEluc2lkZXJzJyxcblx0XHRjbWQ6ICcvaG9tZS9hbGV4Ly52c2NvZGUtc2VydmVyLWluc2lkZXJzL2Jpbi9iYzEzNzg1ZDNkZDk5YjRiMGU5ZGE5YWVkMTdiYjc5ODA5YTUwODA0L25vZGUtLW1heC1vbGQtc3BhY2Utc2l6ZT0zMDcyL2hvbWUvYWxleC8udnNjb2RlLXNlcnZlci1pbnNpZGVycy9iaW4vYmMxMzc4NWQzZGQ5OWI0YjBlOWRhOWFlZDE3YmI3OTgwOWE1MDgwNC9leHRlbnNpb25zL25vZGVfbW9kdWxlcy90eXBlc2NyaXB0L2xpYi90c3NlcnZlci5qcy0tdXNlSW5mZXJyZWRQcm9qZWN0UGVyUHJvamVjdFJvb3QtLWVuYWJsZVRlbGVtZXRyeS0tY2FuY2VsbGF0aW9uUGlwZU5hbWUvdG1wL3ZzY29kZS10eXBlc2NyaXB0MTAwMC83Y2ZhNzE3MWMwYzAwYWFjZjFlZS90c2NhbmNlbGxhdGlvbi0wNGEwYjkyZjg4MGMyZmQ1MzVhZS50bXAqLS1sb2dWZXJib3NpdHl2ZXJib3NlLS1sb2dGaWxlL2hvbWUvYWxleC8udnNjb2RlLXNlcnZlci1pbnNpZGVycy9kYXRhL2xvZ3MvMjAyMDEyMDhUMTQ1OTU0L2V4dGhvc3QyL3ZzY29kZS50eXBlc2NyaXB0LWxhbmd1YWdlLWZlYXR1cmVzL3Rzc2VydmVyLWxvZy1mcXlCcnMvdHNzZXJ2ZXIubG9nLS1nbG9iYWxQbHVnaW5zdHlwZXNjcmlwdC12c2NvZGUtc2gtcGx1Z2luLS1wbHVnaW5Qcm9iZUxvY2F0aW9ucy9ob21lL2FsZXgvLnZzY29kZS1zZXJ2ZXItaW5zaWRlcnMvYmluL2JjMTM3ODVkM2RkOTliNGIwZTlkYTlhZWQxN2JiNzk4MDlhNTA4MDQvZXh0ZW5zaW9ucy90eXBlc2NyaXB0LWxhbmd1YWdlLWZlYXR1cmVzLS1sb2NhbGVlbi0tbm9HZXRFcnJPbkJhY2tncm91bmRVcGRhdGUtLXZhbGlkYXRlRGVmYXVsdE5wbUxvY2F0aW9uJ1xuXHR9LFxuXHR7XG5cdFx0cGlkOiAyNzM5LFxuXHRcdGN3ZDogJy9tbnQvYy9Vc2Vycy9hbHJvcy9BcHBEYXRhL0xvY2FsL1Byb2dyYW1zL01pY3Jvc29mdCBWUyBDb2RlIEluc2lkZXJzJyxcblx0XHRjbWQ6ICcvaG9tZS9hbGV4Ly52c2NvZGUtc2VydmVyLWluc2lkZXJzL2Jpbi9iYzEzNzg1ZDNkZDk5YjRiMGU5ZGE5YWVkMTdiYjc5ODA5YTUwODA0L25vZGUvaG9tZS9hbGV4Ly52c2NvZGUtc2VydmVyLWluc2lkZXJzL2Jpbi9iYzEzNzg1ZDNkZDk5YjRiMGU5ZGE5YWVkMTdiYjc5ODA5YTUwODA0L2V4dGVuc2lvbnMvbm9kZV9tb2R1bGVzL3R5cGVzY3JpcHQvbGliL3R5cGluZ3NJbnN0YWxsZXIuanMtLWdsb2JhbFR5cGluZ3NDYWNoZUxvY2F0aW9uL2hvbWUvYWxleC8uY2FjaGUvdHlwZXNjcmlwdC80LjEtLWVuYWJsZVRlbGVtZXRyeS0tbG9nRmlsZS9ob21lL2FsZXgvLnZzY29kZS1zZXJ2ZXItaW5zaWRlcnMvZGF0YS9sb2dzLzIwMjAxMjA4VDE0NTk1NC9leHRob3N0Mi92c2NvZGUudHlwZXNjcmlwdC1sYW5ndWFnZS1mZWF0dXJlcy90c3NlcnZlci1sb2ctZnF5QnJzL3RpLTI3MjUubG9nLS10eXBlc01hcExvY2F0aW9uL2hvbWUvYWxleC8udnNjb2RlLXNlcnZlci1pbnNpZGVycy9iaW4vYmMxMzc4NWQzZGQ5OWI0YjBlOWRhOWFlZDE3YmI3OTgwOWE1MDgwNC9leHRlbnNpb25zL25vZGVfbW9kdWxlcy90eXBlc2NyaXB0L2xpYi90eXBlc01hcC5qc29uLS12YWxpZGF0ZURlZmF1bHROcG1Mb2NhdGlvbidcblx0fSxcblx0e1xuXHRcdHBpZDogMjc5NSxcblx0XHRjd2Q6ICcvaG9tZS9hbGV4L3JlcG9zL01pY3Jvc29mdC92c2NvZGUtZXh0ZW5zaW9uLXNhbXBsZXMvaGVsbG93b3JsZC1zYW1wbGUnLFxuXHRcdGNtZDogJy9ob21lL2FsZXgvLnZzY29kZS1zZXJ2ZXItaW5zaWRlcnMvYmluL2JjMTM3ODVkM2RkOTliNGIwZTlkYTlhZWQxN2JiNzk4MDlhNTA4MDQvbm9kZS9ob21lL2FsZXgvLnZzY29kZS1zZXJ2ZXItaW5zaWRlcnMvYmluL2JjMTM3ODVkM2RkOTliNGIwZTlkYTlhZWQxN2JiNzk4MDlhNTA4MDQvZXh0ZW5zaW9ucy9qc29uLWxhbmd1YWdlLWZlYXR1cmVzL3NlcnZlci9kaXN0L25vZGUvanNvblNlcnZlck1haW4tLW5vZGUtaXBjLS1jbGllbnRQcm9jZXNzSWQ9MjUwNCdcblx0fSxcblx0e1xuXHRcdHBpZDogMjg2LFxuXHRcdGN3ZDogJy9tbnQvYy9Vc2Vycy9hbHJvcy9BcHBEYXRhL0xvY2FsL1Byb2dyYW1zL01pY3Jvc29mdCBWUyBDb2RlIEluc2lkZXJzJyxcblx0XHRjbWQ6ICdzaC1jXFxcIiRWU0NPREVfV1NMX0VYVF9MT0NBVElPTi8gc2NyaXB0cyAvIHdzbFNlcnZlci5zaFxcXCIgYmMxMzc4NWQzZGQ5OWI0YjBlOWRhOWFlZDE3YmI3OTgwOWE1MDgwNCBpbnNpZGVyIC52c2NvZGUtc2VydmVyLWluc2lkZXJzIDAgICdcblx0fSxcblx0e1xuXHRcdHBpZDogMjg3LFxuXHRcdGN3ZDogJy9tbnQvYy9Vc2Vycy9hbHJvcy9BcHBEYXRhL0xvY2FsL1Byb2dyYW1zL01pY3Jvc29mdCBWUyBDb2RlIEluc2lkZXJzJyxcblx0XHRjbWQ6ICdzaC9tbnQvYy9Vc2Vycy9hbHJvcy8udnNjb2RlLWluc2lkZXJzL2V4dGVuc2lvbnMvbXMtdnNjb2RlLXJlbW90ZS5yZW1vdGUtd3NsLTAuNTIuMC9zY3JpcHRzL3dzbFNlcnZlci5zaGJjMTM3ODVkM2RkOTliNGIwZTlkYTlhZWQxN2JiNzk4MDlhNTA4MDRpbnNpZGVyLnZzY29kZS1zZXJ2ZXItaW5zaWRlcnMwJ1xuXHR9LFxuXHR7XG5cdFx0cGlkOiAzMDU4LFxuXHRcdGN3ZDogJy9ob21lL2FsZXgvcmVwb3MvTWljcm9zb2Z0L3ZzY29kZS1leHRlbnNpb24tc2FtcGxlcy9oZWxsb3dvcmxkLXNhbXBsZScsXG5cdFx0Y21kOiAnbnBtJ1xuXHR9LFxuXHR7XG5cdFx0cGlkOiAzMDcwLFxuXHRcdGN3ZDogJy9ob21lL2FsZXgvcmVwb3MvTWljcm9zb2Z0L3ZzY29kZS1leHRlbnNpb24tc2FtcGxlcy9oZWxsb3dvcmxkLXNhbXBsZScsXG5cdFx0Y21kOiAnc2gtY3RzYyAtd2F0Y2ggLXAgLi8nXG5cdH0sXG5cdHtcblx0XHRwaWQ6IDMwNzEsXG5cdFx0Y3dkOiAnL2hvbWUvYWxleC9yZXBvcy9NaWNyb3NvZnQvdnNjb2RlLWV4dGVuc2lvbi1zYW1wbGVzL2hlbGxvd29ybGQtc2FtcGxlJyxcblx0XHRjbWQ6ICdub2RlL2hvbWUvYWxleC9yZXBvcy9NaWNyb3NvZnQvdnNjb2RlLWV4dGVuc2lvbi1zYW1wbGVzL2hlbGxvd29ybGQtc2FtcGxlL25vZGVfbW9kdWxlcy8uYmluL3RzYy13YXRjaC1wLi8nXG5cdH0sXG5cdHtcblx0XHRwaWQ6IDMxMixcblx0XHRjd2Q6ICcvbW50L2MvVXNlcnMvYWxyb3MvQXBwRGF0YS9Mb2NhbC9Qcm9ncmFtcy9NaWNyb3NvZnQgVlMgQ29kZSBJbnNpZGVycycsXG5cdFx0Y21kOiAnc2gvaG9tZS9hbGV4Ly52c2NvZGUtc2VydmVyLWluc2lkZXJzL2Jpbi9iYzEzNzg1ZDNkZDk5YjRiMGU5ZGE5YWVkMTdiYjc5ODA5YTUwODA0L3NlcnZlci5zaC0tcG9ydD0wLS11c2UtaG9zdC1wcm94eS0tZW5hYmxlLXJlbW90ZS1hdXRvLXNodXRkb3duLS1wcmludC1pcC1hZGRyZXNzJ1xuXHR9LFxuXHR7XG5cdFx0cGlkOiAzMTQsXG5cdFx0Y3dkOiAnL21udC9jL1VzZXJzL2Fscm9zL0FwcERhdGEvTG9jYWwvUHJvZ3JhbXMvTWljcm9zb2Z0IFZTIENvZGUgSW5zaWRlcnMnLFxuXHRcdGNtZDogJy9ob21lL2FsZXgvLnZzY29kZS1zZXJ2ZXItaW5zaWRlcnMvYmluL2JjMTM3ODVkM2RkOTliNGIwZTlkYTlhZWQxN2JiNzk4MDlhNTA4MDQvbm9kZS9ob21lL2FsZXgvLnZzY29kZS1zZXJ2ZXItaW5zaWRlcnMvYmluL2JjMTM3ODVkM2RkOTliNGIwZTlkYTlhZWQxN2JiNzk4MDlhNTA4MDQvb3V0L3NlcnZlci1tYWluLmpzLS1wb3J0PTAtLXVzZS1ob3N0LXByb3h5LS1lbmFibGUtcmVtb3RlLWF1dG8tc2h1dGRvd24tLXByaW50LWlwLWFkZHJlc3MnXG5cdH0sXG5cdHtcblx0XHRwaWQ6IDMxNzIsXG5cdFx0Y3dkOiAnL2hvbWUvYWxleCcsXG5cdFx0Y21kOiAnL2Jpbi9iYXNoJ1xuXHR9LFxuXHR7XG5cdFx0cGlkOiAzNjEwLFxuXHRcdGN3ZDogJy9ob21lL2FsZXgvcmVwb3MvTWljcm9zb2Z0L3ZzY29kZS1leHRlbnNpb24tc2FtcGxlcy9oZWxsb3dvcmxkLXNhbXBsZScsXG5cdFx0Y21kOiAnL2Jpbi9iYXNoJ1xuXHR9LFxuXHR7XG5cdFx0cGlkOiA0NDEyLFxuXHRcdGN3ZDogJy9ob21lL2FsZXgvcmVwb3MvTWljcm9zb2Z0L3ZzY29kZS1leHRlbnNpb24tc2FtcGxlcy9oZWxsb3dvcmxkLXNhbXBsZScsXG5cdFx0Y21kOiAnaHR0cC1zZXJ2ZXInXG5cdH0sXG5cdHtcblx0XHRwaWQ6IDQ0OTYsXG5cdFx0Y3dkOiAnL21udC9jL1VzZXJzL2Fscm9zL0FwcERhdGEvTG9jYWwvUHJvZ3JhbXMvTWljcm9zb2Z0IFZTIENvZGUgSW5zaWRlcnMnLFxuXHRcdGNtZDogJy9ob21lL2FsZXgvLnZzY29kZS1zZXJ2ZXItaW5zaWRlcnMvYmluL2JjMTM3ODVkM2RkOTliNGIwZTlkYTlhZWQxN2JiNzk4MDlhNTA4MDQvbm9kZS0taW5zcGVjdC1icms9MC4wLjAuMDo2ODk5L2hvbWUvYWxleC8udnNjb2RlLXNlcnZlci1pbnNpZGVycy9iaW4vYmMxMzc4NWQzZGQ5OWI0YjBlOWRhOWFlZDE3YmI3OTgwOWE1MDgwNC9vdXQvYm9vdHN0cmFwLWZvcmstLXR5cGU9ZXh0ZW5zaW9uSG9zdC0tdHJhbnNmb3JtVVJJcy0tdXNlSG9zdFByb3h5PSdcblx0fSxcblx0e1xuXHRcdHBpZDogNDUwNyxcblx0XHRjd2Q6ICcvbW50L2MvVXNlcnMvYWxyb3MvQXBwRGF0YS9Mb2NhbC9Qcm9ncmFtcy9NaWNyb3NvZnQgVlMgQ29kZSBJbnNpZGVycycsXG5cdFx0Y21kOiAnL2hvbWUvYWxleC8udnNjb2RlLXNlcnZlci1pbnNpZGVycy9iaW4vYmMxMzc4NWQzZGQ5OWI0YjBlOWRhOWFlZDE3YmI3OTgwOWE1MDgwNC9ub2RlL2hvbWUvYWxleC8udnNjb2RlLXNlcnZlci1pbnNpZGVycy9iaW4vYmMxMzc4NWQzZGQ5OWI0YjBlOWRhOWFlZDE3YmI3OTgwOWE1MDgwNC9leHRlbnNpb25zL21zLXZzY29kZS5qcy1kZWJ1Zy9zcmMvaGFzaC5idW5kbGUuanMnXG5cdH1cbl07XG5cbmNvbnN0IHBzU3RkT3V0ID1cblx0YDQgUyByb290ICAgICAgICAgMSAgICAgMCAgMCAgODAgICAwIC0gICA1OTYgLSAgICAgICAxNDQwICAgMiAxNDo0MSA/ICAgICAgICAwMDowMDowMCAvYmluL3NoIC1jIGVjaG8gQ29udGFpbmVyIHN0YXJ0ZWQgOyB0cmFwIFwiZXhpdCAwXCIgMTU7IHdoaWxlIHNsZWVwIDEgJiB3YWl0ICQhOyBkbyA6OyBkb25lXG40IFMgcm9vdCAgICAgICAgMTQgICAgIDAgIDAgIDgwICAgMCAtICAgNTk2IC0gICAgICAgIDc2NCAgIDQgMTQ6NDEgPyAgICAgICAgMDA6MDA6MDAgL2Jpbi9zaFxuNCBTIHJvb3QgICAgICAgIDQwICAgICAwICAwICA4MCAgIDAgLSAgIDU5NiAtICAgICAgICA3MDAgICA0IDE0OjQxID8gICAgICAgIDAwOjAwOjAwIC9iaW4vc2hcbjQgUyByb290ICAgICAgIDUxMyAgIDM4MCAgMCAgODAgICAwIC0gIDI0NzYgLSAgICAgICAzNDA0ICAgMSAxNDo0MSBwdHMvMSAgICAwMDowMDowMCBzdWRvIG5weCBodHRwLXNlcnZlciAtcCA1MDAwXG40IFMgcm9vdCAgICAgICA1MTQgICA1MTMgIDAgIDgwICAgMCAtIDE2NTQzOSAtICAgICA0MTM4MCAgIDUgMTQ6NDEgcHRzLzEgICAgMDA6MDA6MDAgaHR0cC1zZXJ2ZXJcbjAgUyByb290ICAgICAgMTA1MiAgICAgMSAgMCAgODAgICAwIC0gICA1NzMgLSAgICAgICAgNzUyICAgNSAxNDo0MyA/ICAgICAgICAwMDowMDowMCBzbGVlcCAxXG4wIFMgbm9kZSAgICAgIDEwNTYgICAzMjkgIDAgIDgwICAgMCAtICAgNTk2IGRvX3dhaSAgIDc2NCAgMTAgMTQ6NDMgPyAgICAgICAgMDA6MDA6MDAgL2Jpbi9zaCAtYyBwcyAtRiAtQSAtbCB8IGdyZXAgcm9vdFxuMCBTIG5vZGUgICAgICAxMDU4ICAxMDU2ICAwICA4MCAgIDAgLSAgIDc3MCBwaXBlX3cgICA4ODggICA5IDE0OjQzID8gICAgICAgIDAwOjAwOjAwIGdyZXAgcm9vdGA7XG5cbnN1aXRlKCdFeHRIb3N0VHVubmVsU2VydmljZScsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cdHRlc3QoJ2dldFNvY2tldHMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gZ2V0U29ja2V0cyhwcm9jU29ja2V0cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKE9iamVjdC5rZXlzKHJlc3VsdCkubGVuZ3RoLCA3NSk7XG5cdFx0Ly8gNDQxMiBpcyB0aGUgcGlkIG9mIHRoZSBodHRwLXNlcnZlciBpbiB0aGUgdGVzdCBkYXRhXG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKE9iamVjdC5rZXlzKHJlc3VsdCkuZmluZChrZXkgPT4gcmVzdWx0W2tleV0ucGlkID09PSA0NDEyKSwgdW5kZWZpbmVkKTtcblx0fSk7XG5cblx0dGVzdCgnbG9hZENvbm5lY3Rpb25UYWJsZScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXN1bHQgPSBsb2FkQ29ubmVjdGlvblRhYmxlKHRjcCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5sZW5ndGgsIDYpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0WzBdLCB7XG5cdFx0XHQxMDogJzEnLFxuXHRcdFx0MTE6ICcwMDAwMDAwMDEwMTczMzEyJyxcblx0XHRcdDEyOiAnMTAwJyxcblx0XHRcdDEzOiAnMCcsXG5cdFx0XHQxNDogJzAnLFxuXHRcdFx0MTU6ICcxMCcsXG5cdFx0XHQxNjogJzAnLFxuXHRcdFx0aW5vZGU6ICcyMzM1MjE0Jyxcblx0XHRcdGxvY2FsX2FkZHJlc3M6ICcwMDAwMDAwMDowQkJBJyxcblx0XHRcdHJlbV9hZGRyZXNzOiAnMDAwMDAwMDA6MDAwMCcsXG5cdFx0XHRyZXRybnNtdDogJzAwMDAwMDAwJyxcblx0XHRcdHNsOiAnMDonLFxuXHRcdFx0c3Q6ICcwQScsXG5cdFx0XHR0aW1lb3V0OiAnMCcsXG5cdFx0XHR0cjogJzAwOjAwMDAwMDAwJyxcblx0XHRcdHR4X3F1ZXVlOiAnMDAwMDAwMDA6MDAwMDAwMDAnLFxuXHRcdFx0dWlkOiAnMTAwMCdcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbG9hZExpc3RlbmluZ1BvcnRzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc3VsdCA9IGxvYWRMaXN0ZW5pbmdQb3J0cyh0Y3AsIHRjcDYpO1xuXHRcdC8vIFRoZXJlIHNob3VsZCBiZSA3IGJhc2VkIG9uIHRoZSBpbnB1dCBkYXRhLiBPbmUgb2YgdGhlbSBzaG91bGQgYmUgMzAwMi5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lmxlbmd0aCwgNyk7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHJlc3VsdC5maW5kKHZhbHVlID0+IHZhbHVlLnBvcnQgPT09IDMwMDIpLCB1bmRlZmluZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCd0cnlGaW5kUm9vdFBvcnRzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJvb3RQcm9jZXNzZXMgPSBnZXRSb290UHJvY2Vzc2VzKHBzU3RkT3V0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9vdFByb2Nlc3Nlcy5sZW5ndGgsIDYpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IHRyeUZpbmRSb290UG9ydHMoW3sgc29ja2V0OiAxMDAwLCBpcDogJzEyNy4wLjAuMScsIHBvcnQ6IDUwMDAgfV0sIHBzU3RkT3V0LCBuZXcgTWFwKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuc2l6ZSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5nZXQoNTAwMCk/LnBpZCwgNTE0KTtcblx0fSk7XG5cblx0dGVzdCgnZmluZFBvcnRzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZpbmRQb3J0cyhsb2FkTGlzdGVuaW5nUG9ydHModGNwLCB0Y3A2KSwgZ2V0U29ja2V0cyhwcm9jU29ja2V0cyksIHByb2Nlc3Nlcyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHRbMF0uaG9zdCwgJzAuMC4wLjAnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0WzBdLnBvcnQsIDMwMDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHRbMF0uZGV0YWlsLCAnaHR0cC1zZXJ2ZXInKTtcblx0fSk7XG5cblx0dGVzdCgncGFyc2VJcEFkZHJlc3MnLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnNlSXBBZGRyZXNzKCcwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMTAwMDAwMCcpLCAnMDowOjA6MDowOjA6MDoxJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnNlSXBBZGRyZXNzKCcwMDAwMDAwMDAwMDAwMDAwRkZGRjAwMDAwNDA1MTBBQycpLCAnMDowOjA6MDowOmZmZmY6YWMxMDo1MDQnKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFdBQVcsa0JBQWtCLFlBQVkscUJBQXFCLG9CQUFvQixnQkFBZ0Isd0JBQXdCO0FBQ25JLFNBQVMsK0NBQStDO0FBRXhELE1BQU0sTUFDTDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBUUQsTUFBTSxPQUNMO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBY0QsTUFBTSxjQUNMO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFpRkQsTUFBTSxZQUF5RDtBQUFBLEVBQzlEO0FBQUEsSUFDQyxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsRUFDTjtBQUFBLEVBQ0E7QUFBQSxJQUNDLEtBQUs7QUFBQSxJQUNMLEtBQUs7QUFBQSxJQUNMLEtBQUs7QUFBQSxFQUNOO0FBQUEsRUFDQTtBQUFBLElBQ0MsS0FBSztBQUFBLElBQ0wsS0FBSztBQUFBLElBQ0wsS0FBSztBQUFBLEVBQ047QUFBQSxFQUNBO0FBQUEsSUFDQyxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsRUFDTjtBQUFBLEVBQUc7QUFBQSxJQUNGLEtBQUs7QUFBQSxJQUNMLEtBQUs7QUFBQSxJQUNMLEtBQUs7QUFBQSxFQUNOO0FBQUEsRUFDQTtBQUFBLElBQ0MsS0FBSztBQUFBLElBQ0wsS0FBSztBQUFBLElBQ0wsS0FBSztBQUFBLEVBQ047QUFBQSxFQUNBO0FBQUEsSUFDQyxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsRUFDTjtBQUFBLEVBQ0E7QUFBQSxJQUNDLEtBQUs7QUFBQSxJQUNMLEtBQUs7QUFBQSxJQUNMLEtBQUs7QUFBQSxFQUNOO0FBQUEsRUFDQTtBQUFBLElBQ0MsS0FBSztBQUFBLElBQ0wsS0FBSztBQUFBLElBQ0wsS0FBSztBQUFBLEVBQ047QUFBQSxFQUNBO0FBQUEsSUFDQyxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsRUFDTjtBQUFBLEVBQ0E7QUFBQSxJQUNDLEtBQUs7QUFBQSxJQUNMLEtBQUs7QUFBQSxJQUNMLEtBQUs7QUFBQSxFQUNOO0FBQUEsRUFDQTtBQUFBLElBQ0MsS0FBSztBQUFBLElBQ0wsS0FBSztBQUFBLElBQ0wsS0FBSztBQUFBLEVBQ047QUFBQSxFQUNBO0FBQUEsSUFDQyxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsRUFDTjtBQUFBLEVBQ0E7QUFBQSxJQUNDLEtBQUs7QUFBQSxJQUNMLEtBQUs7QUFBQSxJQUNMLEtBQUs7QUFBQSxFQUNOO0FBQUEsRUFDQTtBQUFBLElBQ0MsS0FBSztBQUFBLElBQ0wsS0FBSztBQUFBLElBQ0wsS0FBSztBQUFBLEVBQ047QUFBQSxFQUNBO0FBQUEsSUFDQyxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsRUFDTjtBQUFBLEVBQ0E7QUFBQSxJQUNDLEtBQUs7QUFBQSxJQUNMLEtBQUs7QUFBQSxJQUNMLEtBQUs7QUFBQSxFQUNOO0FBQUEsRUFDQTtBQUFBLElBQ0MsS0FBSztBQUFBLElBQ0wsS0FBSztBQUFBLElBQ0wsS0FBSztBQUFBLEVBQ047QUFBQSxFQUNBO0FBQUEsSUFDQyxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsRUFDTjtBQUFBLEVBQ0E7QUFBQSxJQUNDLEtBQUs7QUFBQSxJQUNMLEtBQUs7QUFBQSxJQUNMLEtBQUs7QUFBQSxFQUNOO0FBQ0Q7QUFFQSxNQUFNLFdBQ0w7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQVNELE1BQU0sd0JBQXdCLE1BQU07QUFDbkMsMENBQXdDO0FBQ3hDLE9BQUssY0FBYyxXQUFZO0FBQzlCLFVBQU0sU0FBUyxXQUFXLFdBQVc7QUFDckMsV0FBTyxZQUFZLE9BQU8sS0FBSyxNQUFNLEVBQUUsUUFBUSxFQUFFO0FBRWpELFdBQU8sZUFBZSxPQUFPLEtBQUssTUFBTSxFQUFFLEtBQUssU0FBTyxPQUFPLEdBQUcsRUFBRSxRQUFRLElBQUksR0FBRyxNQUFTO0FBQUEsRUFDM0YsQ0FBQztBQUVELE9BQUssdUJBQXVCLFdBQVk7QUFDdkMsVUFBTSxTQUFTLG9CQUFvQixHQUFHO0FBQ3RDLFdBQU8sWUFBWSxPQUFPLFFBQVEsQ0FBQztBQUNuQyxXQUFPLGdCQUFnQixPQUFPLENBQUMsR0FBRztBQUFBLE1BQ2pDLElBQUk7QUFBQSxNQUNKLElBQUk7QUFBQSxNQUNKLElBQUk7QUFBQSxNQUNKLElBQUk7QUFBQSxNQUNKLElBQUk7QUFBQSxNQUNKLElBQUk7QUFBQSxNQUNKLElBQUk7QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLGVBQWU7QUFBQSxNQUNmLGFBQWE7QUFBQSxNQUNiLFVBQVU7QUFBQSxNQUNWLElBQUk7QUFBQSxNQUNKLElBQUk7QUFBQSxNQUNKLFNBQVM7QUFBQSxNQUNULElBQUk7QUFBQSxNQUNKLFVBQVU7QUFBQSxNQUNWLEtBQUs7QUFBQSxJQUNOLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLHNCQUFzQixXQUFZO0FBQ3RDLFVBQU0sU0FBUyxtQkFBbUIsS0FBSyxJQUFJO0FBRTNDLFdBQU8sWUFBWSxPQUFPLFFBQVEsQ0FBQztBQUNuQyxXQUFPLGVBQWUsT0FBTyxLQUFLLFdBQVMsTUFBTSxTQUFTLElBQUksR0FBRyxNQUFTO0FBQUEsRUFDM0UsQ0FBQztBQUVELE9BQUssb0JBQW9CLFdBQVk7QUFDcEMsVUFBTSxnQkFBZ0IsaUJBQWlCLFFBQVE7QUFDL0MsV0FBTyxZQUFZLGNBQWMsUUFBUSxDQUFDO0FBQzFDLFVBQU0sU0FBUyxpQkFBaUIsQ0FBQyxFQUFFLFFBQVEsS0FBTSxJQUFJLGFBQWEsTUFBTSxJQUFLLENBQUMsR0FBRyxVQUFVLG9CQUFJLElBQUksQ0FBQztBQUNwRyxXQUFPLFlBQVksT0FBTyxNQUFNLENBQUM7QUFDakMsV0FBTyxZQUFZLE9BQU8sSUFBSSxHQUFJLEdBQUcsS0FBSyxHQUFHO0FBQUEsRUFDOUMsQ0FBQztBQUVELE9BQUssYUFBYSxpQkFBa0I7QUFDbkMsVUFBTSxTQUFTLE1BQU0sVUFBVSxtQkFBbUIsS0FBSyxJQUFJLEdBQUcsV0FBVyxXQUFXLEdBQUcsU0FBUztBQUNoRyxXQUFPLFlBQVksT0FBTyxRQUFRLENBQUM7QUFDbkMsV0FBTyxZQUFZLE9BQU8sQ0FBQyxFQUFFLE1BQU0sU0FBUztBQUM1QyxXQUFPLFlBQVksT0FBTyxDQUFDLEVBQUUsTUFBTSxJQUFJO0FBQ3ZDLFdBQU8sWUFBWSxPQUFPLENBQUMsRUFBRSxRQUFRLGFBQWE7QUFBQSxFQUNuRCxDQUFDO0FBRUQsT0FBSyxrQkFBa0IsV0FBWTtBQUNsQyxXQUFPLFlBQVksZUFBZSxrQ0FBa0MsR0FBRyxpQkFBaUI7QUFDeEYsV0FBTyxZQUFZLGVBQWUsa0NBQWtDLEdBQUcseUJBQXlCO0FBQUEsRUFDakcsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
