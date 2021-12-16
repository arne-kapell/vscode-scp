/**
@File    : deploy.js
@Time    : 2021/12/16 11:22:03
@Version : 0.1
@License : Apache License Version 2.0, January 2004
@Desc    : None
 */
const util = require("./helper")
const fs = require("fs")
const path = require('path');
const vscode = require("vscode")
const client = require("node-sshclient");
const { time } = require("console");

class Deploy {
    constructor() {
        this.syncToRemote = this.syncToRemote.bind(this);
        this.syncAll = this.syncAll.bind(this);
        this.travel = this.travel.bind(this);
        this.newCfg = this.newCfg.bind(this);
        this.scpTrans = this.scpTrans.bind(this);
        this.deleteFromRemote = this.deleteFromRemote.bind(this);
        this.root_path = vscode.workspace.workspaceFolders[0]["uri"]["_fsPath"];
        this.cfpath = this.root_path + "/.vscode/scp.json";
        this.readCfg()
    }
    makCfg(cfname) {
        fs.writeFile(cfname, `{
    "host": "LocalHost",
    "port": 22,
    "user": "root",
    "ignore":[".git",".vscode"],
    "remotePath": "/root",
    "uploadOnSave": true
}`, (err) => {
            if (err) {
                vscode.window.showInformationMessage(`配置文件创建失败`)
            } else {
                vscode.window.showInformationMessage(`创建配置文件成功`)
            }
        })
    }
    newCfg() {
        let dirname = this.root_path + "/.vscode"
        let cfname = this.root_path + "/.vscode/scp.json"
        if (!fs.existsSync(dirname)) {
            fs.mkdir(dirname, (direrr) => {
                if (direrr) {
                    vscode.window.showInformationMessage(`创建文件夹：${dirname}失败 `)
                } else {
                    this.makCfg(cfname)
                }
            })
        } else {
            this.makCfg(cfname)
        }
    }
    readCfg() {
        if (fs.existsSync(this.cfpath)) {
            fs.readFile(this.cfpath, (err, data) => {
                if (err) {
                    console.log(err)
                } else {
                    this.config = JSON.parse(data.toString("utf-8"))
                }
            })
        }
    }
    sshCommand(ssh, command) {
        return new Promise((resolve) => {
            ssh.command(command, (result) => {
                resolve(result)
            })
        })
    }
    scpTrans(local_path, remote_path) {
        console.log("开始传输文件", local_path, remote_path)
        let options = {
            "hostname": this.config["host"],
            "port": parseInt(this.config["port"]),
            "user": this.config["user"]
        }
        const scp = new client.SCP(options)
        const ssh = new client.SSH(options)
        this.sshCommand(ssh, `cd ${remote_path}`).then((result) => {
            if (result["stderr"]) {
                this.sshCommand(ssh, `mkdir ${remote_path}`).then((res) => {
                    if (res["stderr"]) {
                        vscode.window.showErrorMessage(res["stderr"])
                    } else {
                        scp.upload(local_path, remote_path, (result) => {
                            console.log(result)
                            if (result["stderr"]) {
                                vscode.window.showErrorMessage(result["stderr"])
                            } else {
                                vscode.window.showInformationMessage("同步成功")
                            }
                        })
                    }
                })
            } else {
                scp.upload(local_path, remote_path, (result) => {
                    console.log(result)
                    if (result["stderr"]) {
                        vscode.window.showErrorMessage(result["stderr"])
                    } else {
                        vscode.window.showInformationMessage("同步成功")
                    }
                })
            }
        })
    }
    travel(dir) {
        let that = this
        fs.readdir(dir, (err, files) => {
            if (err) {
                console.log(err)
            } else {
                files.forEach((file) => {
                    var pathname = path.join(dir, file)
                    fs.stat(pathname, (err, stats) => {
                        if (err) {
                            console.log(err)
                        } else if (stats.isDirectory()) {
                            that.travel(pathname)
                        } else {
                            that.scpToRemote(pathname)
                        }
                    })
                })
            }
        })
    }
    syncToRemote({ fileName }) {
        this.scpToRemote(fileName)
    }
    scpToRemote(fileName) {
        if (fs.existsSync(this.cfpath)) {
            this.readCfg()
            if (this.config["uploadOnSave"]) {
                if (!this.config["remotePath"]) {
                    vscode.window.showErrorMessage("配置文件缺少remotePath,请填写完整")
                    return;
                }
                let local_path = fileName
                let remote_path = path.dirname(fileName.replace(this.root_path, this.config["remotePath"]).replace(/[\\]/g, '/'))
                if (local_path.indexOf(".vscode") != -1) {
                    return;
                }

                if (this.config["ignore"] && this.config["ignore"].length > 0) {
                    for (let dir in this.config["ignore"]) {
                        if (local_path.indexOf(dir) != -1) {
                            return;
                        }
                    }
                    this.scpTrans(local_path, remote_path)
                } else {
                    this.scpTrans(local_path, remote_path)
                }

            }
        }
    }
    deleteFromRemote(files) {
        console.log(files)
    }

    syncAll() {
        this.travel(this.root_path)
    }
    deactivate() {
        util.channel.dispose();
    }
}

module.exports = Deploy;