const fs = require('fs');
const path = require('path');

let FtpDeploy = require("ftp-deploy");
let FtpDeployLib = require("ftp-deploy/src/lib");

// Файл с информацией об авторизации на ftpи папкой назначения деплоя
let auth = require(path.resolve(__dirname, 'deploy_auth'));
// Файл с правилами деплоя
let externalRules;
try {
    externalRules = require(path.resolve(__dirname, 'deploy_rules'));
} catch (error) {
    externalRules = {
        default: {}
    };
}

// Получаем имя правила конфига деплоя из окружения
const RULE = process.env && process.env.RULE && process.env.RULE;

// Возвращает абсолютный путь к файлу в контексте проекта
const filePath = (file, folder = '') => path.resolve(__dirname, config.localRoot, folder === '/' ? '' : folder, file[0] === '/' ? file.slice(1) : file);
// Возвращает размер файла
const fileSize = (file, folder = '') => fs.statSync(filePath(file, folder)).size;

const extend = (orig, ext) => {
    return {
        ...orig,
        ...ext
    };
}

// Возвращает объект с размерами файлов, которые будут загружены:
// {
// 'абсолютный/путь/до.файла': размер_файла
// ...
// fullSize: общий_размер_всех_файлов_деплоя
// amount: количество_файлов_деплоя
// }
const collectUploadSizes = filemap => {
    let sizesObj = {};
    let fullSize = 0;
    let amount = 0;

    for (let folder in filemap) {
        filemap[folder].forEach(file => {
            let path = filePath(file, folder);
            let size = fileSize(path);

            sizesObj[path] = size;
            fullSize += size;
            amount++;
        });
    }

    sizesObj.fullSize = fullSize;
    sizesObj.amount = amount;

    return sizesObj;
}

// Человекопонятное представление размеров файлов
const humanSize = (size = 0, extend = false) => {
    size = +size;
    if (isNaN(size)) return false;
    let level_counter = 0;
    let levels = [
        'Б', 'КБ', 'МБ', 'ГБ', 'ТБ'
    ];

    function check(size) {
        if (size > 1024 && level_counter < 4) {
            level_counter++;
            return check(size / 1024);
        } else {
            return size;
        }
    }

    if (extend) {
        return {
            size: check(size),
            level: level_counter,
            unit: levels[level_counter],
        };
    } else {
        return `${check(size).toFixed(1)} ${levels[level_counter]}`;
    }
}

let config = {
    user: auth.user,
    password: auth.password,
    host: auth.host,
    remoteRoot: auth.remoteRoot + auth.hostFolder,
    port: auth.port || 21,
    include: [],
    exclude: []
};

// Дополнение конфига настройками include/exclude в зависимости от правила
function applyRule() {
    let ruleName = externalRules[RULE] ? RULE : 'default';
    let defaultRule = {
        localRoot: __dirname,
        include: ['**/*.*', '**/.*'],
        exclude: ["**/*.map", "node_modules/**", "node_modules/**/*.*", "node_modules/**/.*"],
        deleteRemote: false,
        forcePasv: true,
    };

    if (externalRules.default) {
        defaultRule = extend(defaultRule, externalRules.default);
    }

    let rules = extend(externalRules, {
        'default': defaultRule
    });

    if (typeof rules[ruleName].localRoot !== 'undefined') {
        config.localRoot = path.resolve(__dirname, rules[ruleName].localRoot);
    } else {
        config.localRoot = path.resolve(__dirname, rules.default.localRoot);
    }

    if (rules[ruleName].include) {
        config.include.push(...rules[ruleName].include);
    } else {
        config.include.push(...rules.default.include);
    }

    if (rules[ruleName].exclude) {
        config.exclude.push(...rules[ruleName].exclude);
    } else {
        config.exclude.push(...rules.default.exclude);
    }

    if (typeof rules[ruleName].deleteRemote !== 'undefined') {
        config.deleteRemote = rules[ruleName].deleteRemote;
    } else {
        config.deleteRemote = rules.default.deleteRemote;
    }

    if (typeof rules[ruleName].forcePasv !== 'undefined') {
        config.forcePasv = rules[ruleName].forcePasv;
    } else {
        config.forcePasv = rules.default.forcePasv;
    }

    console.log('%s\x1b[32m%s\x1b[0m', 'Deploy:RULE === ', ruleName);
}

applyRule();

let filemap = FtpDeployLib.parseLocal(config.include, config.exclude, config.localRoot, '/');
// console.log('filemap:', filemap);
let uploadSizes = collectUploadSizes(filemap);
let uploadedSize = 0;

console.log('%s\x1b[36m%s\x1b[0m%s\x1b[35m%s\x1b[0m', 'Deploy:START - ', `[${uploadSizes.amount} | ${humanSize(uploadSizes.fullSize)}]`, ' --> ', auth.baseUrl + auth.hostFolder);

let ftpDeploy = new FtpDeploy();

ftpDeploy
    .deploy(config)
    .then(res => console.log('\x1b[7m%s\x1b[0m', ' Deploy:FINISH '))
    .catch(err => console.log('Deploy:ERROR', err));

ftpDeploy.on('uploaded', function (data) {
    uploadedSize += uploadSizes[filePath(data.filename)];
    console.log('%s\x1b[36m%s\x1b[0m\x1b[32m%s\x1b[0m', 'Deploy:UPLOADED', ` [${data.transferredFileCount}/${data.totalFilesCount} | ${humanSize(uploadedSize)}] `, `${data.filename}`)
});