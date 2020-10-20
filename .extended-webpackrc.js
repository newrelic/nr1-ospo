module.exports = {
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif|svg|ttf|eot|woff2)$/,
        use: [
          {
            loader: 'file-loader',
            options: {},
          },
        ],
      },
    ],
  },
};