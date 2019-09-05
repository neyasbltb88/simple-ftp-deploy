module.exports = {
    default: {
        localRoot: 'test',
    },
    fast: {
        exclude: [
            'img/**/*.*',

            '**/*.map',
            'node_modules/**',
            'node_modules/**/*.*',
            'node_modules/**/.*'
        ],
    }
}