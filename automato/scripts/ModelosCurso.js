const fs = require("fs/promises");
const path = require("path");
const { temasPublicacao } = require("./PaletasCores");

const diretorioModelos = path.resolve(__dirname, "modelos");
const diretorioEstilos = path.join(diretorioModelos, "estilos");
const diretorioBibliotecasModelos = path.join(diretorioModelos, "modelo-bibliotecas");
const arquivoEstilosHierarquia = path.join(diretorioModelos, "modeloBase", "styles", "hierarquia-componentes.css");
const arquivoEstilosDesktop = path.join(diretorioModelos, "modeloBase", "styles", "desktop-ajustes.css");
const arquivosWbtEsperados = Array.from({ length: 6 }, (_, indice) => `modelo_${indice + 1}_0.html`);
const arquivosBibliotecaEsperados = Array.from({ length: 5 }, (_, indice) => `biblioteca_${indice + 1}_0.html`);
const nomeArquivoEstiloModelo = "estilos-centralizados.css";

function criarErroModelo(mensagem) {
    const erro = new Error(mensagem);
    erro.name = "ErroModelo";
    erro.publicMessage = mensagem;
    return erro;
}

async function obterModeloDisponivel(modeloId = "modelo1") {
    const id = String(modeloId || "modelo1").trim().toLowerCase();
    if (!/^modelo\d+$/.test(id)) {
        throw criarErroModelo("O modelo selecionado é inválido.");
    }

    const diretorioModelo = path.resolve(diretorioModelos, id);
    if (!diretorioModelo.startsWith(`${diretorioModelos}${path.sep}`)) {
        throw criarErroModelo("O modelo selecionado é inválido.");
    }

    const diretorioWbt = path.join(diretorioBibliotecasModelos, "wbtmodelo");
    const diretorioBiblioteca = path.join(diretorioBibliotecasModelos, "biblioteca");
    const arquivoEstiloModelo = path.join(diretorioModelo, nomeArquivoEstiloModelo);

    try {
        await Promise.all([
            ...arquivosWbtEsperados.map(nome => fs.access(path.join(diretorioWbt, nome))),
            ...arquivosBibliotecaEsperados.map(nome => fs.access(path.join(diretorioBiblioteca, nome))),
            fs.access(arquivoEstiloModelo)
        ]);
    } catch (erro) {
        if (erro.code === "ENOENT") {
            throw criarErroModelo(`O ${id} ainda não está completo para gerar cursos.`);
        }
        throw erro;
    }

    return {
        id,
        diretorioModelo,
        diretorioWbt,
        diretorioBiblioteca,
        arquivoEstiloModelo,
        arquivosBiblioteca: arquivosBibliotecaEsperados
    };
}

async function listarModelosDisponiveis() {
    let itens;
    try {
        itens = await fs.readdir(diretorioModelos, { withFileTypes: true });
    } catch (erro) {
        if (erro.code === "ENOENT") return [];
        throw erro;
    }

    const pastasModelo = itens
        .filter(item => item.isDirectory() && /^modelo\d+$/.test(item.name))
        .sort((a, b) => Number(a.name.slice(6)) - Number(b.name.slice(6)));

    const modelos = [];
    for (const pasta of pastasModelo) {
        try {
            const modelo = await obterModeloDisponivel(pasta.name);
            modelos.push({
                id: modelo.id,
                nome: `Modelo ${modelo.id.slice(6)}`
            });
        } catch (erro) {
            if (erro.name !== "ErroModelo") throw erro;
        }
    }
    return modelos;
}

async function aplicarModeloVisual(pastaCurso, modelo, paletaId = "azul") {
    const tema = temasPublicacao[paletaId];
    if (!tema) {
        const erro = new Error("A paleta de cores selecionada é inválida.");
        erro.name = "ErroPaleta";
        erro.publicMessage = erro.message;
        throw erro;
    }

    const arquivoEstilosCores = path.join(diretorioEstilos, `estilos-centralizados-cores-${paletaId}.css`);
    try {
        await fs.access(arquivoEstilosCores);
    } catch (erro) {
        if (erro.code === "ENOENT") {
            const indisponivel = new Error(`O arquivo da paleta ${tema.nome} não foi encontrado na pasta de estilos.`);
            indisponivel.name = "ErroPaleta";
            indisponivel.publicMessage = indisponivel.message;
            throw indisponivel;
        }
        throw erro;
    }

    const destinoEstilos = path.join(pastaCurso, "styles");
    const destinoBiblioteca = path.join(pastaCurso, "images", "biblioteca", "biblioteca");

    await fs.mkdir(destinoEstilos, { recursive: true });
    await fs.mkdir(destinoBiblioteca, { recursive: true });
    await Promise.all([
        fs.copyFile(
            arquivoEstilosCores,
            path.join(destinoEstilos, "estilos-centralizados-cores.css")
        ),
        fs.copyFile(
            modelo.arquivoEstiloModelo || path.join(modelo.diretorioModelo, nomeArquivoEstiloModelo),
            path.join(destinoEstilos, nomeArquivoEstiloModelo)
        ),
        // Mantém o CSS comum de aninhamento atualizado também nos cursos existentes.
        fs.copyFile(
            arquivoEstilosHierarquia,
            path.join(destinoEstilos, "hierarquia-componentes.css")
        ),
        // Mantém o dimensionamento de componentes aninhados atualizado em cursos existentes.
        fs.copyFile(
            arquivoEstilosDesktop,
            path.join(destinoEstilos, "desktop-ajustes.css")
        )
    ]);

    await Promise.all(modelo.arquivosBiblioteca.map(nome =>
        fs.copyFile(
            path.join(modelo.diretorioBiblioteca, nome),
            path.join(destinoBiblioteca, nome)
        )
    ));
}

module.exports = {
    obterModeloDisponivel,
    listarModelosDisponiveis,
    aplicarModeloVisual
};
