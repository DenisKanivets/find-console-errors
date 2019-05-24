const axios = require('axios');
const puppeteer = require('puppeteer');
const xl = require('excel4node');

(async () => {
    //enter username and password in string type
    let username = 'TestConsole';
    let password = 'TestConsole';

    //get bearer for request
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
    let headersForBearer = {
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    let sendStrForBearer = `username=${username}&password=${password}&grant_type=password`;
    let bearerObj = {};
    await axios.post('https://dashboard.kyivcity.gov.ua/oauth/token', sendStrForBearer, {headers: headersForBearer})
        .then(res => bearerObj = res.data)
        .catch(err => console.log(err));
    let bearer = bearerObj.access_token;
    console.log('====================BEARER REQUEST FINISHED====================');

    //get urls from request
    let headersForUrls = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + bearer,
        'Accept': 'application/json, text/plain, */*'
    };
    let sendObjForUrls = {
        'queryCode': "SearchUserConsoleErrors",
        'limit': 999,
        'parameterValues': [{"key": "@UserName", "value": username}]
    };
    let urlsArr = [];
    await axios.post('https://dashboard.kyivcity.gov.ua/api/ds/utility/query/getvalues', sendObjForUrls, {headers: headersForUrls})
        .then(res => urlsArr = res.data)
        .catch(err => console.log(err));
    urlsArr = urlsArr.rows.map(item => item.values[0]);
    console.log(urlsArr);
    console.log('quantity of dashboards: ' + urlsArr.length);
    console.log('====================URLS REQUEST FINISHED====================');

    //check for errors
    const browser = await puppeteer.launch();
    const headers = {
        'Authorization': 'Bearer ' + bearer
    };
    let errArr = [];
    let timeArr = [];
    for (let i = 0; i < urlsArr.length; i++) {
        let oldTime = new Date();
        const url = 'https://dashboard.kyivcity.gov.ua/dashboard/page/' + urlsArr[i];
        console.log(url);
        const page = await browser.newPage();
        page.setExtraHTTPHeaders(headers);
        let check = false;
        page.on('console', msg => {
            check = true;
            msg._args.map(item => {
                if (item._remoteObject.type === 'object' && item._remoteObject.subtype === 'error') {
                    let obj = {};
                    obj[url] = item._remoteObject.description;
                    errArr.push(obj);
                    console.log('error was founded')
                }
            })
        });
        if (!check) {
            let obj = {};
            obj[url] = 'NO ERRORS';
            errArr.push(obj);
            console.log('no error')
        }
        await page.goto(url, {waitUntil: 'networkidle0'});
        let newTime = new Date();
        let spentTime = newTime - oldTime;
        timeArr.push(spentTime);
    }
    await browser.close();
    console.log('====================CHECKING FOR ERRORS FINISHED====================');

    //write errors to file
    let wb = new xl.Workbook();
    let ws = wb.addWorksheet('Sheet with errors');
    for (let i = 0; i < errArr.length; i++) {
        for (let key in errArr[i]) {
            ws.cell(i + 1, 1)
                .string(key);
            ws.cell(i + 1, 2)
                .string(errArr[i][key])
                .style({alignment: {wrapText: true}});
        }
        ws.cell(i + 1, 3)
            .string(timeArr[i] / 1000 + ' sec');
        ws.column(1).setWidth(75);
        ws.column(2).setWidth(100);
    }
    wb.write(`errors_by_user_(${username}).xlsx`);
    console.log('====================NEW FILE CREATED====================');
    console.log('====================ALL FINISHED====================');
})();