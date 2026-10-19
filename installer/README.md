# Instalador Windows do Delivery OS

O comando `npm run installer:windows` cria `dist\DeliveryOS-Setup.exe`.
O build usa Next.js standalone e inclui um runtime Node.js, por isso o
computador de destino não precisa ter Node.js instalado. O compilador Inno
Setup 6 ou 7 precisa estar instalado na máquina que gera o instalador.

O aplicativo roda apenas em `127.0.0.1`, abre o navegador padrão e guarda o
banco SQLite em `%LOCALAPPDATA%\DeliveryOS\data`. A primeira inicialização
cria uma senha aleatória de administrador e abre o arquivo
`%LOCALAPPDATA%\DeliveryOS\initial-admin.txt` com as instruções de primeiro
acesso. Troque a senha ao entrar e apague o arquivo quando não precisar mais.

Desinstalar o aplicativo não remove o banco, a chave de sessão ou os demais
arquivos de `%LOCALAPPDATA%\DeliveryOS`.
