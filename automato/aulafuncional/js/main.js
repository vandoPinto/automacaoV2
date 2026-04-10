/* Preparar o documento */
var $main = $("main");
var $tela = $("#tela");
var $barraProgresso = $(".nav-telas-progresso a");
var $botaoProxima = $(".nav-telas-proxima");
var $botaoAnterior = $(".nav-telas-anterior");
var totalTelas = $barraProgresso.length;
var alturaTela = $tela.outerHeight();
var larguraTela = $tela.outerWidth();
var telaAtual = 1;
var telaUrl = window.location.href.split("#tela-")[1];
//console.log(telaUrl);
if (telaUrl) {
    if (telaUrl > totalTelas+1 || telaUrl == 0) {
        telaAtual = 1;
    } else {
        telaAtual = telaUrl;
    }
}

$("a[href^='#tela-']").each(function (i) {
    var numTela = parseInt($(this).attr("href").split("-")[1]);
    $(this).click(function () {
        carregarTela(numTela);
    });
});


$barraProgresso.each(function (i) {
    $(this).attr("href", "#tela-" + (i+1))
        .click(function () {
            carregarTela(i+1);
        });
});

$(".nav-indice-abrir").click(abrirIndice);
$(".nav-indice-fechar").click(fecharIndice);

$botaoProxima.click(function () {
    carregarTela(telaAtual + 1);
})
$botaoAnterior.click(function () {
    carregarTela(telaAtual - 1);
})

/* Abre o menu do índice, colocando a largura em 250px */
function abrirIndice() {
    $("#indice").width(250).css("overflow-y", "auto").css("overflow-x","hidden");
}

/* Fecha o menu do índice, colocando a largura em 0 */
function fecharIndice() {
    $("#indice").width(0).css("overflow", "hidden");
}

/* Carregar e exibir Tela(Slide) */
// function carregarTela(numeroTela) {
//     telaAtual = parseInt(numeroTela);
//     if (telaAtual > totalTelas) telaAtual = totalTelas;
//     if (telaAtual < 1) telaAtual = 1;

//     var url = "tela-" + telaAtual + ".html";
//     $("#tela").load(url, atualizarNav);
// }


/* Carregar e exibir Tela(Slide) */
function carregarTela(numeroTela) {
    telaAtual = parseInt(numeroTela);
    if (telaAtual > totalTelas) telaAtual = totalTelas;
    if (telaAtual < 1) telaAtual = 1;

    var url = "tela-" + telaAtual + ".html";
    
    $("#tela").load(url, atualizarNav);
    if(($(".nav-indice-lista").find("a[href='#tela-"+telaAtual+"']")).length){
        $("a[href^='#tela-']").removeClass('active');
        $("a[href='#tela-"+telaAtual+"']").addClass('active');
    }else{
        let pag = telaAtual;       
        while ($(".nav-indice-lista").find("a[href='#tela-"+pag+"']").length==0) {
            pag--;
            console.log($(".nav-indice-lista").find("a[href='#tela-"+pag+"']").length);
            if($(".nav-indice-lista").find("a[href='#tela-"+pag+"']").length){
                $("a[href^='#tela-']").removeClass('active');
                $("a[href='#tela-"+pag+"']").addClass('active');
            }
        }
    }
}


function atualizarNav() {
    $botaoProxima.attr("href", "#tela-" + (telaAtual + 1));
    $botaoAnterior.attr("href", "#tela-" + (telaAtual - 1));

    if (telaAtual == (totalTelas)) $botaoProxima.css("display", "none");
    if (telaAtual < (totalTelas)) $botaoProxima.css("display", "block");
    if (telaAtual == 0 || telaAtual == 1) $botaoAnterior.css("display", "none");
    if (telaAtual > 1) $botaoAnterior.css("display", "block");

    $(".tela-atual").removeClass("tela-atual");
    $(".tela-visualizada").removeClass("tela-visualizada");

    $($barraProgresso).eq(telaAtual-1).addClass("tela-atual");
    for (i = 0; i < telaAtual; i++) {
        $($barraProgresso[i]).addClass("tela-visualizada");
    }
}

document.onkeydown = function (e) {
    /*if (e.keyCode == 13) {
        carregarTela(telaAtual + 1);
    }
    if (e.keyCode == 32) {
        carregarTela(telaAtual + 1);
    }*/
    if (e.keyCode == 39) {
      carregarTela(telaAtual + 1);
    }
    if (e.keyCode == 37) {
        carregarTela(telaAtual - 1);
    }
    var hashTela = "#tela-" + telaAtual;
    window.location.hash = hashTela;
}

/* redimensionador do slide */
function redimensionar() {

    var alturaHeader = $("header").outerHeight();
    var alturaFooter = $("footer").outerHeight();

    var alturaMain = $(window).height() - (alturaHeader + alturaFooter + 10);

    $main.height(alturaMain);

    var larguraMain = $main.width() - 120;

    var proporcao;
    proporcao = Math.min(
        larguraMain / larguraTela,
        alturaMain / alturaTela
    );

    $tela.css({
        transform: "translate(-50%,-50%)" + "scale(" + proporcao + ","+proporcao+")"
    });
}

$(window).on('resize', redimensionar);

/* Paginador */
$(".nav-telas-progresso a span")
    .wrapInner("<span class='nav-telas-progresso-titulo'></span>")
    .append("<span class='nav-telas-progresso-pagina'></span>")
    .wrapInner("<span></span>");
var $titulos = $(".nav-telas-progresso-titulo");
var $pagTelas = $(".nav-telas-progresso-pagina");
var qtTelas = $pagTelas.length;
var texto;
for (i = 0; i < qtTelas; i++) {
    texto = "Tela " + (i + 1) + " de " + qtTelas + ".";
    if ($($titulos[i]).html().length == 0) {
        $($titulos[i]).append(texto);
    } else {
        $($pagTelas[i]).append(texto);
    }
}

carregarTela(telaAtual);
redimensionar();