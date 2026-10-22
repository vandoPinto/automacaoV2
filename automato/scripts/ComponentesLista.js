// scripts/ComponentesLista.js
/**
 * Módulo que agrupa todos os componentes utilizados no projeto.
 *
 * Os componentes devem ser importados e exportados para que possam ser utilizados
 * em outros módulos.
 *
 * Exemplo de como utilizar: const Componentes = require("./ComponentesLista");
 * const apresentacao = Componentes.apresentacao("Este é um exemplo de apresentação");
 * console.log(apresentacao);
 */
module.exports = {
    abas: require("./Componentes/abas/abas"),
    apresentacao: require("./Componentes/apresentacao/apresentacao"),
    audio: require("./Componentes/audio/audio"),
    botaotela: require("./Componentes/botaotela/botaotela"),
    capitulo: require("./Componentes/capitulo/capitulo"),
    exercitando: require("./Componentes/exercitando/exercitando"),
    fechamento: require("./Componentes/fechamento/fechamento"),
    flashcard: require("./Componentes/flashcard/flashcard"),
    importante: require("./Componentes/importante/importante"),
    introducao: require("./Componentes/introducao/introducao"),
    mininavegacao: require("./Componentes/miniNavegacao/miniNavegacao"),
    objetivos: require("./Componentes/objetivos/objetivos"),
    saibamais: require("./Componentes/saibamais/saibamais"),
    texto: require("./Componentes/texto/texto"),
    textocomimagem: require("./Componentes/textocomimagem/textocomimagem"),
};