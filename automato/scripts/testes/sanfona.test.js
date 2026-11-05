const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { processarComponente } = require("../ProcessarComponentesAninhados");

async function executar() {
    const entrada = `
        <p>Texto introdutório da tela.</p>
        <sanfona>
            <botao><strong>Primeiro painel</strong>
            <janela>
                <p>Conteúdo do primeiro painel.</p>
            <botao><strong>Segundo painel</strong>
            <janela>
                <p>Conteúdo do segundo painel com a expressão palavra destacada. <hotword>palavra destacada<janela>Explicação complementar da hotword.</hotword></p>
            <botao><strong>Terceiro painel</strong>
            <janela>
                <p>Conteúdo do terceiro painel.</p>
                <botoes>
                    <botao>Botão interno</botao>
                    <janela>Janela do botão interno.</janela>
                </botoes>
        </sanfona>
        <p>TEXTO POSTERIOR DEVE PERMANECER FORA DA SANFONA.</p>
    `;

    const html = await processarComponente("tela", entrada, 1, 701);

    assert.strictEqual((html.match(/class="sanfona-item"/g) || []).length, 3,
        "A sanfona deve gerar três painéis.");
    assert.strictEqual((html.match(/class="sanfona-botao"/g) || []).length, 3,
        "A sanfona deve gerar três botões.");
    assert.strictEqual((html.match(/class="sanfona-painel"/g) || []).length, 3,
        "A sanfona deve gerar três áreas de conteúdo.");
    assert.strictEqual((html.match(/class="sanfona-botao"[\s\S]*?aria-expanded="false"/g) || []).length, 3,
        "Todos os painéis devem iniciar fechados.");
    assert.strictEqual((html.match(/class="sanfona-painel"[\s\S]*?hidden/g) || []).length, 3,
        "Todas as áreas de conteúdo devem iniciar ocultas.");
    assert(html.includes("Conteúdo do primeiro painel."));
    assert(html.includes("Conteúdo do segundo painel"));
    assert(html.includes("Conteúdo do terceiro painel."));
    assert(html.includes("class=\"hotword-gatilho\""),
        "HOTWORD dentro de um painel deve continuar sendo processada.");
    assert(html.includes("Explicação complementar da hotword."));
    assert(html.includes("TEXTO POSTERIOR DEVE PERMANECER FORA DA SANFONA."),
        "O conteúdo posterior a </sanfona> deve permanecer na Tela.");
    assert(!html.includes("<sanfona>") && !html.includes("</sanfona>"),
        "Os marcadores estruturais não devem aparecer no HTML final.");
    assert(html.includes("if (!estavaAberto) abrir(botao)"),
        "O script deve permitir fechar o painel aberto ao clicar novamente.");
    assert(html.includes("botoes.forEach(fechar)"),
        "Ao abrir outro painel, o painel anterior deve ser fechado.");

    console.log("✓ SANFONA gera a quantidade correta de painéis.");
    console.log("✓ Todos os painéis iniciam fechados e somente um pode ficar aberto.");
    console.log("✓ HOTWORD dentro do painel continua funcionando.");
    console.log("✓ Conteúdo posterior a </sanfona> permanece na Tela.");

    await assert.rejects(
        () => processarComponente("tela", "<sanfona><botao>Título</botao><janela>Conteúdo</janela>", 1, 702),
        /não possui o fechamento <\/sanfona>/i,
        "A ausência de fechamento explícito deve gerar erro claro."
    );
    console.log("✓ SANFONA sem fechamento explícito apresenta erro.");

    const aninhada = await processarComponente(
        "tela",
        `<sanfona>
            <botao>Painel externo
            <janela>
                <p>Conteúdo externo.</p>
                <sanfona>
                    <botao>Painel interno
                    <janela>Conteúdo interno.</janela>
                </sanfona>
            </janela>
        </sanfona>`,
        1, 703
    );
    assert.strictEqual((aninhada.match(/class="sanfona-componente"/g) || []).length, 2,
        "Uma SANFONA deve poder conter outra SANFONA.");
    assert(aninhada.includes("Conteúdo externo."));
    assert(aninhada.includes("Conteúdo interno."));
    console.log("✓ SANFONA aninhada é processada recursivamente.");

    // Executa o script real do template com elementos simulados para validar
    // a alternância dos painéis, sem depender de um navegador externo.
    const template = fs.readFileSync(
        path.join(__dirname, "../Componentes/sanfona/sanfona.html"),
        "utf8"
    );
    const script = template.match(/<script>([\s\S]*?)<\/script>/i)[1]
        .replace(/{{ID_COMPONENTE}}/g, "sanfona-teste");
    const botoes = [];
    const paineis = new Map();

    for (let i = 1; i <= 3; i++) {
        const atributos = { "aria-controls": `painel-${i}` };
        const eventos = {};
        botoes.push({
            closest: () => raiz,
            getAttribute: nome => atributos[nome],
            setAttribute: (nome, valor) => { atributos[nome] = valor; },
            addEventListener: (nome, callback) => { eventos[nome] = callback; },
            clicar: () => eventos.click(),
            atributos
        });
        paineis.set(`painel-${i}`, { hidden: false, classList: {add(){},remove(){}}, offsetHeight: 0 });
    }

    const raiz = {
        dataset: {},
        querySelectorAll: seletor => seletor === ".sanfona-botao" ? botoes : []
    };
    const documentoSimulado = {
        getElementById: id => id === "sanfona-teste" ? raiz : paineis.get(id)
    };

    vm.runInNewContext(script, { document: documentoSimulado, window: {matchMedia: () => ({matches:true})}, clearTimeout, setTimeout });

    assert(botoes.every(botao => botao.atributos["aria-expanded"] === "false"));
    assert([...paineis.values()].every(painel => painel.hidden));

    botoes[0].clicar();
    assert.strictEqual(botoes[0].atributos["aria-expanded"], "true");
    assert.strictEqual(paineis.get("painel-1").hidden, false);

    botoes[1].clicar();
    assert.strictEqual(botoes[0].atributos["aria-expanded"], "false");
    assert.strictEqual(paineis.get("painel-1").hidden, true);
    assert.strictEqual(botoes[1].atributos["aria-expanded"], "true");
    assert.strictEqual(paineis.get("painel-2").hidden, false);

    botoes[1].clicar();
    assert(botoes.every(botao => botao.atributos["aria-expanded"] === "false"));
    assert([...paineis.values()].every(painel => painel.hidden));
    console.log("✓ Interação real do script: abre um painel, troca para outro e fecha ao clicar novamente.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
