/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports.describe = function({testRunner, expect, FFOX, CHROMIUM, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('BrowserContext.cookies', function() {
    it('should return no cookies in pristine browser context', async({context, page, server}) => {
      expect(await context.cookies()).toEqual([]);
    });
    it('should get a cookie', async({context, page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate(() => {
        document.cookie = 'username=John Doe';
      });
      expect(await context.cookies()).toEqual([{
        name: 'username',
        value: 'John Doe',
        domain: 'localhost',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        session: true,
        sameSite: 'None',
      }]);
    });
    it('should properly report httpOnly cookie', async({context, page, server}) => {
      server.setRoute('/empty.html', (req, res) => {
        res.setHeader('Set-Cookie', 'name=value;HttpOnly; Path=/');
        res.end();
      });
      await page.goto(server.EMPTY_PAGE);
      const cookies = await context.cookies();
      expect(cookies.length).toBe(1);
      expect(cookies[0].httpOnly).toBe(true);
    });
    it.skip(WEBKIT && process.platform !== 'darwin')('should properly report "Strict" sameSite cookie', async({context, page, server}) => {
      server.setRoute('/empty.html', (req, res) => {
        res.setHeader('Set-Cookie', 'name=value;SameSite=Strict');
        res.end();
      });
      await page.goto(server.EMPTY_PAGE);
      const cookies = await context.cookies();
      expect(cookies.length).toBe(1);
      expect(cookies[0].sameSite).toBe('Strict');
    });
    it.skip(WEBKIT && process.platform !== 'darwin')('should properly report "Lax" sameSite cookie', async({context, page, server}) => {
      server.setRoute('/empty.html', (req, res) => {
        res.setHeader('Set-Cookie', 'name=value;SameSite=Lax');
        res.end();
      });
      await page.goto(server.EMPTY_PAGE);
      const cookies = await context.cookies();
      expect(cookies.length).toBe(1);
      expect(cookies[0].sameSite).toBe('Lax');
    });
    it('should get multiple cookies', async({context, page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate(() => {
        document.cookie = 'username=John Doe';
        document.cookie = 'password=1234';
      });
      const cookies = await context.cookies();
      cookies.sort((a, b) => a.name.localeCompare(b.name));
      expect(cookies).toEqual([
        {
          name: 'password',
          value: '1234',
          domain: 'localhost',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          session: true,
          sameSite: 'None',
        },
        {
          name: 'username',
          value: 'John Doe',
          domain: 'localhost',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          session: true,
          sameSite: 'None',
        },
      ]);
    });
    it('should get cookies from multiple urls', async({context}) => {
      await context.setCookies([{
        url: 'https://foo.com',
        name: 'doggo',
        value: 'woofs',
      }, {
        url: 'https://bar.com',
        name: 'catto',
        value: 'purrs',
      }, {
        url: 'https://baz.com',
        name: 'birdo',
        value: 'tweets',
      }]);
      const cookies = await context.cookies('https://foo.com', 'https://baz.com');
      cookies.sort((a, b) => a.name.localeCompare(b.name));
      expect(cookies).toEqual([{
        name: 'birdo',
        value: 'tweets',
        domain: 'baz.com',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: true,
        session: true,
        sameSite: 'None',
      }, {
        name: 'doggo',
        value: 'woofs',
        domain: 'foo.com',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: true,
        session: true,
        sameSite: 'None',
      }]);
    });
  });

  describe('BrowserContext.setCookies', function() {
    it('should work', async({context, page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await context.setCookies([{
        url: server.EMPTY_PAGE,
        name: 'password',
        value: '123456'
      }]);
      expect(await page.evaluate(() => document.cookie)).toEqual('password=123456');
    });
    it('should isolate cookies in browser contexts', async({context, server, newContext}) => {
      const anotherContext = await newContext();
      await context.setCookies([{url: server.EMPTY_PAGE, name: 'page1cookie', value: 'page1value'}]);
      await anotherContext.setCookies([{url: server.EMPTY_PAGE, name: 'page2cookie', value: 'page2value'}]);

      const cookies1 = await context.cookies();
      const cookies2 = await anotherContext.cookies();
      expect(cookies1.length).toBe(1);
      expect(cookies2.length).toBe(1);
      expect(cookies1[0].name).toBe('page1cookie');
      expect(cookies1[0].value).toBe('page1value');
      expect(cookies2[0].name).toBe('page2cookie');
      expect(cookies2[0].value).toBe('page2value');
    });
    it('should set multiple cookies', async({context, page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await context.setCookies([{
        url: server.EMPTY_PAGE,
        name: 'password',
        value: '123456'
      }, {
        url: server.EMPTY_PAGE,
        name: 'foo',
        value: 'bar'
      }]);
      expect(await page.evaluate(() => {
        const cookies = document.cookie.split(';');
        return cookies.map(cookie => cookie.trim()).sort();
      })).toEqual([
        'foo=bar',
        'password=123456',
      ]);
    });
    it('should have |expires| set to |-1| for session cookies', async({context, server}) => {
      await context.setCookies([{
        url: server.EMPTY_PAGE,
        name: 'password',
        value: '123456'
      }]);
      const cookies = await context.cookies();
      expect(cookies[0].session).toBe(true);
      expect(cookies[0].expires).toBe(-1);
    });
    it('should set cookie with reasonable defaults', async({context, server}) => {
      await context.setCookies([{
        url: server.EMPTY_PAGE,
        name: 'password',
        value: '123456'
      }]);
      const cookies = await context.cookies();
      expect(cookies.sort((a, b) => a.name.localeCompare(b.name))).toEqual([{
        name: 'password',
        value: '123456',
        domain: 'localhost',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        session: true,
        sameSite: 'None',
      }]);
    });
    it('should set a cookie with a path', async({context, page, server}) => {
      await page.goto(server.PREFIX + '/grid.html');
      await context.setCookies([{
        domain: 'localhost',
        path: '/grid.html',
        name: 'gridcookie',
        value: 'GRID',
      }]);
      expect(await context.cookies()).toEqual([{
        name: 'gridcookie',
        value: 'GRID',
        domain: 'localhost',
        path: '/grid.html',
        expires: -1,
        httpOnly: false,
        secure: false,
        session: true,
        sameSite: 'None',
      }]);
      expect(await page.evaluate('document.cookie')).toBe('gridcookie=GRID');
      await page.goto(server.EMPTY_PAGE);
      expect(await page.evaluate('document.cookie')).toBe('');
      await page.goto(server.PREFIX + '/grid.html');
      expect(await page.evaluate('document.cookie')).toBe('gridcookie=GRID');
    });
    it('should not set a cookie with blank page URL', async function({context, server}) {
      let error = null;
      try {
        await context.setCookies([
            {url: server.EMPTY_PAGE, name: 'example-cookie', value: 'best'},
            {url: 'about:blank', name: 'example-cookie-blank', value: 'best'}
        ]);
      } catch (e) {
        error = e;
      }
      expect(error.message).toEqual(
          `Blank page can not have cookie "example-cookie-blank"`
      );
    });
    it('should not set a cookie on a data URL page', async function({context}) {
      let error = null;
      try {
        await context.setCookies([{url: 'data:,Hello%2C%20World!', name: 'example-cookie', value: 'best'}]);
      } catch (e) {
        error = e;
      }
      expect(error.message).toContain('Data URL page can not have cookie "example-cookie"');
    });
    it('should default to setting secure cookie for HTTPS websites', async({context, page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      const SECURE_URL = 'https://example.com';
      await context.setCookies([{
        url: SECURE_URL,
        name: 'foo',
        value: 'bar',
      }]);
      const [cookie] = await context.cookies(SECURE_URL);
      expect(cookie.secure).toBe(true);
    });
    it('should be able to set unsecure cookie for HTTP website', async({context, page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      const HTTP_URL = 'http://example.com';
      await context.setCookies([{
        url: HTTP_URL,
        name: 'foo',
        value: 'bar',
      }]);
      const [cookie] = await context.cookies(HTTP_URL);
      expect(cookie.secure).toBe(false);
    });
    it('should set a cookie on a different domain', async({context, page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await context.setCookies([{
        url: 'https://www.example.com',
        name: 'example-cookie',
        value: 'best',
      }]);
      expect(await page.evaluate('document.cookie')).toBe('');
      expect(await context.cookies('https://www.example.com')).toEqual([{
        name: 'example-cookie',
        value: 'best',
        domain: 'www.example.com',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: true,
        session: true,
        sameSite: 'None',
      }]);
    });
    it('should set cookies from a frame', async({context, page, server}) => {
      await page.goto(server.PREFIX + '/grid.html');
      await context.setCookies([
        {url: server.PREFIX, name: 'localhost-cookie', value: 'best'},
        {url: server.CROSS_PROCESS_PREFIX, name: '127-cookie', value: 'worst'}
      ]);
      await page.evaluate(src => {
        let fulfill;
        const promise = new Promise(x => fulfill = x);
        const iframe = document.createElement('iframe');
        document.body.appendChild(iframe);
        iframe.onload = fulfill;
        iframe.src = src;
        return promise;
      }, server.CROSS_PROCESS_PREFIX);

      expect(await page.evaluate('document.cookie')).toBe('localhost-cookie=best');
      expect(await page.frames()[1].evaluate('document.cookie')).toBe('127-cookie=worst');

      expect(await context.cookies(server.PREFIX)).toEqual([{
        name: 'localhost-cookie',
        value: 'best',
        domain: 'localhost',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        session: true,
        sameSite: 'None',
      }]);

      expect(await context.cookies(server.CROSS_PROCESS_PREFIX)).toEqual([{
        name: '127-cookie',
        value: 'worst',
        domain: '127.0.0.1',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        session: true,
        sameSite: 'None',
      }]);
    });
  });

  describe('BrowserContext.clearCookies', function() {
    it('should clear cookies', async({context, page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await context.setCookies([{
        url: server.EMPTY_PAGE,
        name: 'cookie1',
        value: '1'
      }]);
      expect(await page.evaluate('document.cookie')).toBe('cookie1=1');
      await context.clearCookies();
      expect(await page.evaluate('document.cookie')).toBe('');
    });
    it('should isolate cookies when clearing', async({context, server, newContext}) => {
      const anotherContext = await newContext();
      await context.setCookies([{url: server.EMPTY_PAGE, name: 'page1cookie', value: 'page1value'}]);
      await anotherContext.setCookies([{url: server.EMPTY_PAGE, name: 'page2cookie', value: 'page2value'}]);

      expect((await context.cookies()).length).toBe(1);
      expect((await anotherContext.cookies()).length).toBe(1);

      await context.clearCookies();
      expect((await context.cookies()).length).toBe(0);
      expect((await anotherContext.cookies()).length).toBe(1);

      await anotherContext.clearCookies();
      expect((await context.cookies()).length).toBe(0);
      expect((await anotherContext.cookies()).length).toBe(0);
    });
  });
};
