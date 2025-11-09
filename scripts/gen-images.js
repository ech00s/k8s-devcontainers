const {writeFileSync,readdirSync} = require('fs')
const {execSync} = require('child_process')
const image = (language)=>`mcr.microsoft.com/devcontainers/${language}:bookworm`;
const languages = [
    "cpp",
    "python",
    "java",
    "go",
    "rust",
    "javascript-node",
    "typescript-node"
]

const template = (image)=>`FROM ${image}\n`+
'RUN apt-get update\n'+
'RUN apt-get install -y openssh-server\n'+
'RUN echo "vscode:0000" | chpasswd\n'+
'EXPOSE 22\n'+
'CMD ["service","ssh","start","-D"]'

languages.forEach(l=>writeFileSync(`images/Dockerfile.${l}`,template(image(l))))
readdirSync('images').forEach(d=>{
    execSync(`docker build -t ech00s/ssh-dev-${d.split('.')[1]}:alpha0.1.0 -f images/${d} ./build`,{stdio:"inherit"})
})