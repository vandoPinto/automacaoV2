const temasPublicacao = {
    azul: {
        nome: "Azul institucional",
        variaveis: {
            "--cor-principal": "#1e4e79", "--cor-principal-hover": "#183e62", "--cor-principal-escura": "#153451", "--cor-principal-media": "#326995", "--cor-principal-clara": "#4d83ad", "--cor-principal-gradiente": "#6098c2",
            "--cor-fundo": "#f1f5f9", "--cor-fundo-suave": "#f5f8fc", "--cor-fundo-claro": "#ffffff", "--cor-fundo-neutro": "#edf2f7", "--cor-fundo-hover": "#edf4fa", "--cor-fundo-hover-suave": "#e8f1f9", "--cor-fundo-cartao": "#f4f7fa", "--cor-fundo-identidade": "#e1edf7",
            "--cor-texto": "#252d36", "--cor-texto-principal": "#183b5b", "--cor-texto-secundario": "#244e70", "--cor-texto-terciario": "#526171", "--cor-texto-suave": "#596b7c", "--cor-texto-claro": "#718092", "--cor-texto-escuro": "#172b3d",
            "--cor-borda": "#d8e2ec", "--cor-borda-clara": "#e0e8f0", "--cor-borda-suave": "#e5ebf2", "--cor-borda-identidade": "#d5e2ee", "--cor-borda-forte": "#c4d3e1", "--cor-borda-hover": "#a9bfd3",
            "--cor-destaque": "#e3b84f", "--cor-foco": "#91b7d9", "--cor-foco-claro": "#d0e4f5", "--cor-foco-escuro": "#477da9", "--cor-progresso-fundo": "#d1dfed", "--cor-carregamento-borda": "#d5dfe9",
            "--cor-sombra": "rgba(20, 48, 75, .10)", "--cor-sombra-forte": "rgba(15, 39, 65, .28)", "--cor-overlay": "rgba(15, 35, 55, .48)"
        }
    },
    verde: {
        nome: "Verde natural",
        variaveis: {
            "--cor-principal": "#1f6b4f", "--cor-principal-hover": "#18563f", "--cor-principal-escura": "#123f2f", "--cor-principal-media": "#398568", "--cor-principal-clara": "#65a98c", "--cor-principal-gradiente": "#8ac3a9",
            "--cor-fundo": "#f0f7f3", "--cor-fundo-suave": "#f5faf7", "--cor-fundo-claro": "#ffffff", "--cor-fundo-neutro": "#edf5f0", "--cor-fundo-hover": "#e8f4ed", "--cor-fundo-hover-suave": "#e2f0e8", "--cor-fundo-cartao": "#f4f9f6", "--cor-fundo-identidade": "#dcefe4",
            "--cor-texto": "#26352d", "--cor-texto-principal": "#184f3a", "--cor-texto-secundario": "#27634a", "--cor-texto-terciario": "#566e62", "--cor-texto-suave": "#5d7368", "--cor-texto-claro": "#71857b", "--cor-texto-escuro": "#18372a",
            "--cor-borda": "#d4e4da", "--cor-borda-clara": "#deebe2", "--cor-borda-suave": "#e6f0e9", "--cor-borda-identidade": "#d0e4d8", "--cor-borda-forte": "#bdd5c6", "--cor-borda-hover": "#9ec3ae",
            "--cor-destaque": "#d7a43f", "--cor-foco": "#8ec4a7", "--cor-foco-claro": "#cde8d9", "--cor-foco-escuro": "#4d9874", "--cor-progresso-fundo": "#cde3d6", "--cor-carregamento-borda": "#d4e3da",
            "--cor-sombra": "rgba(20, 65, 46, .10)", "--cor-sombra-forte": "rgba(13, 54, 37, .28)", "--cor-overlay": "rgba(15, 55, 39, .48)"
        }
    },
    roxo: {
        nome: "Roxo contemporâneo",
        variaveis: {
            "--cor-principal": "#5a3c8c", "--cor-principal-hover": "#472f70", "--cor-principal-escura": "#352250", "--cor-principal-media": "#7559aa", "--cor-principal-clara": "#947bc4", "--cor-principal-gradiente": "#b29ad8",
            "--cor-fundo": "#f6f3fa", "--cor-fundo-suave": "#faf8fd", "--cor-fundo-claro": "#ffffff", "--cor-fundo-neutro": "#f0ebf7", "--cor-fundo-hover": "#eee8f7", "--cor-fundo-hover-suave": "#e9e1f4", "--cor-fundo-cartao": "#f8f5fb", "--cor-fundo-identidade": "#e8def5",
            "--cor-texto": "#302b38", "--cor-texto-principal": "#4a3370", "--cor-texto-secundario": "#62458e", "--cor-texto-terciario": "#6d627a", "--cor-texto-suave": "#786d86", "--cor-texto-claro": "#8d8299", "--cor-texto-escuro": "#35244d",
            "--cor-borda": "#e1d9eb", "--cor-borda-clara": "#e9e2f1", "--cor-borda-suave": "#f0ebf5", "--cor-borda-identidade": "#dfd4ee", "--cor-borda-forte": "#cdbde0", "--cor-borda-hover": "#b7a1d2",
            "--cor-destaque": "#d7a43f", "--cor-foco": "#b29ad8", "--cor-foco-claro": "#dfd2f2", "--cor-foco-escuro": "#8064b3", "--cor-progresso-fundo": "#ddcff0", "--cor-carregamento-borda": "#e0d6ec",
            "--cor-sombra": "rgba(67, 42, 101, .10)", "--cor-sombra-forte": "rgba(52, 32, 82, .28)", "--cor-overlay": "rgba(48, 28, 75, .48)"
        }
    }
};

function aplicarTemaDeCores(css, cores) {
    const blocoRoot = css.match(/:root\s*\{([\s\S]*?)\}/i);
    if (!blocoRoot) throw new Error("O CSS do curso não contém o bloco :root com as cores do tema.");
    let conteudoRoot = blocoRoot[1];
    for (const [variavel, valor] of Object.entries(cores)) {
        const escapada = variavel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        conteudoRoot = conteudoRoot.replace(new RegExp(`(${escapada}\\s*:\\s*)[^;]+(;?)`, "g"), `$1${valor}$2`);
    }
    return css.replace(blocoRoot[0], blocoRoot[0].replace(blocoRoot[1], conteudoRoot));
}

module.exports = { temasPublicacao, aplicarTemaDeCores };
