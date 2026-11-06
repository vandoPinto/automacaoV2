const assert = require("assert");
const { validarMarcadoresComponentes, analisarWrappers } = require("../ProcessarComponentesAninhados");

const tags = ["hotword", "botoes", "botao", "janela", "flashcard", "frente", "verso", "abas", "aba", "mininavegacao", "sanfona"];
for (const tag of tags) {
    assert.throws(
        () => validarMarcadoresComponentes(`</${tag}>`, "tela 1"),
        new RegExp(`Fechamento <\\/${tag}> sem abertura`),
        `Fechamento órfão de ${tag} deve ser identificado.`
    );
}
assert.throws(() => validarMarcadoresComponentes("<botoes><botao>Um</botao>", "tela 2"), /não possui o fechamento <\/botoes>/);
assert.throws(() => validarMarcadoresComponentes("<sanfona><janela>Painel</janela>", "tela 3"), /não possui o fechamento <\/sanfona>/);
assert.strictEqual(validarMarcadoresComponentes("<hotword>termo<janela>Definição</janela>", "legado"), true);
assert.strictEqual(validarMarcadoresComponentes("<aba>Painel<janela>Conteúdo", "legado"), true);
assert.throws(() => analisarWrappers('<componente tipo="botao"><p>sem fechamento</p>'), /sem fechamento/);
console.log("Todos os testes da validação central de marcadores passaram.");
