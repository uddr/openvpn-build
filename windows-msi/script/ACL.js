/*
 *  openvpn-build — OpenVPN packaging
 *
 *  Copyright (C) 2024 Lev Stipakov <lev@openvpn.net>
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License version 2
 *  as published by the Free Software Foundation.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License along
 *  with this program; if not, write to the Free Software Foundation, Inc.,
 *  51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

function InProgramFiles(installPath) {
    var shell = new ActiveXObject("WScript.Shell");
    var fso = new ActiveXObject("Scripting.FileSystemObject");

    var programFilesPath = shell.ExpandEnvironmentStrings("%ProgramFiles%");

    installPath = fso.GetAbsolutePathName(installPath).toLowerCase();
    programFilesPath = fso.GetAbsolutePathName(programFilesPath).toLowerCase();

    return installPath.indexOf(programFilesPath) === 0;
}

function DirectoryExists(installPath) {
    var fso = new ActiveXObject("Scripting.FileSystemObject");
    return fso.FolderExists(installPath);
}

function ShowError() {
    var fso = new ActiveXObject("Scripting.FileSystemObject");

    // generate tmp file path
    var tmpFolder = fso.GetSpecialFolder(2); // 2 is the value for the temp folder
    var tmpFullPath = fso.BuildPath(tmpFolder.Path, fso.GetTempName() + ".vbs");

    var file = fso.CreateTextFile(tmpFullPath);
    file.WriteLine('MsgBox "For security reasons you are not permitted to install OpenVPN into existing directory except under %ProgramFiles%.", vbSystemModal');
    file.Close();

    var shell = new ActiveXObject("WScript.Shell");
    shell.Run("cscript //nologo " + tmpFullPath, 0, true);

    fso.DeleteFile(tmpFullPath);
}

function GetInstallDir() {
    var installPath = Session.Property("PRODUCTDIR");

    if (InProgramFiles(installPath)) {
        // under ProgramFiles we do not modify ACL
        Session.Property("SetACL") = "";
        return 0;
    } else if (DirectoryExists(installPath)) {
        // don't allow to install into existing directory except under ProgramFiles
        ShowError();
        return 1603;
    }

    // save installPath, to be read by deferred action to modify ACL
    Session.Property("SetACL") = installPath;
    return 0;
}

function RunIcacls(cmd) {
    var shell = new ActiveXObject("WScript.Shell");
    var execObject = shell.Exec('icacls.exe ' + cmd);
    if (execObject.ExitCode != 0) {
        throw new Error("icacls exited with code " + exitCode);
    }
}

function SetACL() {
    var targetDir = Session.Property("CustomActionData");
    if (targetDir == "") {
        // installed in ProgramFiles, not modifying ACL
        return 0;
    }

    // trim trailing slash
    if (targetDir.charAt(targetDir.length - 1) === '\\') {
        targetDir = targetDir.substring(0, targetDir.length - 1);
    }

    try {
        RunIcacls(targetDir + ' /inheritance:r /grant "Administrators:(OI)(CI)F" /grant "System:(OI)(CI)F" /grant "Users:(OI)(CI)RX"');
    } catch (e) {
        Session.Property("CUSTOMACTIONERROR") = e.message;
        return 1603; // Indicates a fatal error during installation.
    }

    return 0;
}
