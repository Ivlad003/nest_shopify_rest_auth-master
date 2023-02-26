import { Controller, Get, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { HttpService } from '@nestjs/axios';
import * as fs from 'fs/promises';

const scopes = 'write_products';
const forwardingAddressNgrok = 'your-ngrok-url';
// your-ngrok-url/shopify?shop=crazycart0.myshopify.com/

const SHOPIFY_API_KEY = 'you-api-key';
const SHOPIFY_API_SECRET = 'your-api-secret';
const shopName = 'your-shop-name.myshopify.com';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly httpService: HttpService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('products')
  async getProduct(@Req() req, @Res() res): Promise<any> {
    let access_token = null;
    try {
      access_token = await fs.readFile('./token', { encoding: 'utf8' });
    } catch (err) {
      if (!access_token) {
        const redirectUrl =
          forwardingAddressNgrok + `/shopify?shop=${shopName}`;
        return res.redirect(redirectUrl);
      }
    }

    const apiRequestURL = `https://${shopName}/admin/api/2021-10/products.json`;
    const apiResponse = await this.httpService.axiosRef.get(apiRequestURL, {
      headers: {
        'X-Shopify-Access-Token': access_token,
      },
    });

    return res.status(200).json(apiResponse.data);
  }

  @Get('/shopify')
  shopify(@Req() req, @Res() res): string {
    const shopName = req.query.shop;
    if (shopName) {
      // shopify callback redirect
      const redirectURL = forwardingAddressNgrok + '/shopify/callback';

      const installUrl = `https://${shopName}admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${redirectURL}`;

      return res.redirect(installUrl);
    } else {
      return res.status(400).send('Missing "Shop Name" parameter!!');
    }
  }

  @Get('/shopify/callback')
  async shopifyCallback(@Req() req, @Res() res): Promise<string> {
    const { shop, hmac, code, shopState } = req.query;
    const stateCookie = req.cookies.shopState;

    if (shopState !== stateCookie) {
      return res.status(400).send('request origin cannot be found');
    }

    if (shop && hmac && code) {
      const accessTokenRequestUrl =
        'https://' + shop + '/admin/oauth/access_token';
      const accessTokenPayload = {
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
      };

      const result = await this.httpService.axiosRef.post(
        accessTokenRequestUrl,
        accessTokenPayload,
      );

      try {
        await fs.writeFile('./token', result.data.access_token);
      } catch (err) {
        console.log(err);
      }
      return res.status(200).send('success');
    } else {
      return res.status(400).send('required parameter missing');
    }
  }
}
