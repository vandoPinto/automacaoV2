/* PPU 04/2021 */

function init(){
    unasus.pack.initialize();

    let status = unasus.pack.getStatus();

    if (status === undefined){
        status = createStatusDefault();
    }
    if(status === null){
        return false;
    }
    if(telaAtual === 1){
        updatePage(telaAtual)
    }
}

function createStatusDefault(){
    let status = new Object();
    status.status = "attended";
    status.percentage = 0;
    status.LTIvalue = 0;


    /* Módulo 1 - Unidade 1*/
    status.M1U1 = {'1': false, '2': false, '3': false, '4': false, '5': false};
    status.M1U1T1 = {'1': false, '2': false, '3': false};
    status.M1V1 = {'score': 0}

    status.Pages = {'1': false, '2': false, '3': false, '4': false, '5': false, '6': false, '7': false, '8': false, '9': false, '10': false, '11': false, '12': false, 
    '13': false, '14': false, '15': false,'16': false, '17': false, '18': false, '19': false, '20': false, '21': false, '22': false, '23': false, '24': false, '25': false, 
    '26': false};


    status.currentPage = {'current': 0}

    unasus.pack.setStatus(status);

    

    return status;
}

function checkQuestion(exercise, question, correct){
    let status = unasus.pack.getStatus();

    switch(exercise){

        /* Módulo 1 */
        case "M1U1":
            status.M1U1[question] = correct;
            break;
    }
    updateLTI(status);
}

function updateLTI(status){
    let lti = 0.0;

    let score1 = (checkNote("M1U1") / 5);
    lti = score1;
   
    unasus.pack.setStatus(status);
    
}

function updatePage(page){
    let status = unasus.pack.getStatus();

    if (telaAtual !== page){
        status.currentPage['current'] = page;
    } else if(telaAtual > 1){
        status.currentPage['current'] = telaAtual;
    }

    if(status.Pages[page] === false){
        status.Pages[page]= true;
    }
    lastPage();
    unasus.pack.setStatus(status);
}

function checkNote(exercise){
    let status = unasus.pack.getStatus();
    let cont = 0;

    switch(exercise){
        case "M1U1":
            for(let i=1; i<=5; i++){
                if(status.M1U1[i]){
                    cont++;
                }
            }
            break;
    }
    return cont;
}

function lastPage(){
    let status = unasus.pack.getStatus();
    let cont = 0;
    let sizePages = Object.keys(status.Pages).length;

    for(let i=1; i<=sizePages; i++){
        if(status.Pages[i]){
            cont++;
        }
    }
    return cont;
}

function currentPage(){
    let status = unasus.pack.getStatus();
    let currentPageOf = status.currentPage['current'];
    let currentInt = parseInt(currentPageOf);
    return currentInt;
}

function caseAnswer(arrayQuestions, stage) {

    let answer = new Object();

    answer.stage = stage;
    answer.questions = arrayQuestions;

    unasus.pack.setPersistence('ANSWER', answer);
    
    checkQuestion(stage, arrayQuestions[0]['question'], arrayQuestions[0]['correct']);
    
}

function checkScore(){
    let status = unasus.pack.getStatus();
    return status.LTIvalue;
}

function checkAttempt(exercise) {

    let status = unasus.pack.getStatus();
    let cont = 0

    switch(exercise){
        case "M1U1T1":
            for(i=1; i<=3; i++){
                if(!status.M1U1T1[i]){
                    cont++
                }
            } 
            return cont
    }   
}   

function maxAttempt(exercise){
    let status = unasus.pack.getStatus();
    let cont = 0

    switch(exercise){
        case "M1U1T1":
            for(i=1; i<=3; i++){
                if(!status.M1U1T1[i]){
                    cont++
                }
            } 
            if(cont > 0){
                status.M1U1T1[cont]= true;
                unasus.pack.setStatus(status);
            }
            return cont
        }
     
}

let nextScreen = document.querySelectorAll('.nav-telas-proxima')[0];
let backScreen = document.querySelectorAll('.nav-telas-anterior')[0];

backScreen.addEventListener("click", () => {
    updatePage(telaAtual);
});
nextScreen.addEventListener("click", () => {
    updatePage(telaAtual);
});

$(function () {
    init();
});

