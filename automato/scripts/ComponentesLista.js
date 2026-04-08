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
    abas: require("./Componentes/Abas/Abas"),
    apresentacao: require("./Componentes/Apresentacao/Apresentacao"),
    audio: require("./Componentes/Audio/Audio"),
    botaotela: require("./Componentes/Botaotela/Botaotela"),
    capitulo: require("./Componentes/Capitulo/Capitulo"),
    exercitando: require("./Componentes/Exercitando/Exercitando"),
    fechamento: require("./Componentes/Fechamento/Fechamento"),
    flashcard: require("./Componentes/Flashcard/Flashcard"),
    importante: require("./Componentes/Importante/Importante"),
    introducao: require("./Componentes/Introducao/Introducao"),
    mininavegacao: require("./Componentes/MiniNavegacao/MiniNavegacao"),
    objetivos: require("./Componentes/Objetivos/Objetivos"),
    saibamais: require("./Componentes/Saibamais/Saibamais"),
    texto: require("./Componentes/Texto/Texto"),
    textocomimagem: require("./Componentes/Textocomimagem/Textocomimagem"),
};