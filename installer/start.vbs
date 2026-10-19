Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
folder = files.GetParentFolderName(WScript.ScriptFullName)
command = """" & folder & "\runtime\node.exe"" """ & folder & "\launcher.cjs"""
shell.Run command, 0, False
