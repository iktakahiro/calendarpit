import { parseJsonBody, requireSameOrigin } from '../../http/requests';
import { json, noContent } from '../../http/responses';
import type { Route } from '../../http/router';
import { parseAuthorizationRequest } from './authorization-request';
import { consentPageHeaders, renderConsentPage } from './consent-page';
import {
  createClient,
  deleteClient,
  findClient,
  updateClient,
} from './client-operations';
import { identifyClient, publicClient } from './oauth-client';
import {
  authenticate,
  createConsent,
  decideConsent,
  exchangeToken,
  revokeGrant,
  revokeToken,
} from './oauth-operations';
import { allowsEmail, allowsProfile, readUserInfo } from './scopes';

/**
 * Google-compatible OAuth 2.0 endpoints: authorization with a local consent
 * page, token exchange, revocation, and OpenID `userinfo`.
 */
export const oauthGoogleRoutes: Route[] = [
  {
    pattern: /^\/oauth\/authorize$/,
    handle({ workspace, request, url, body }) {
      if (request.method === 'GET') {
        const params = url.searchParams;
        const client = identifyClient(workspace.data.clients, params);
        const consent = parseAuthorizationRequest(
          client,
          params,
          workspace.now(),
        );
        const nonce = createConsent(workspace, consent);
        return new Response(
          renderConsentPage(consent, nonce, workspace.data.users),
          { headers: consentPageHeaders(consent) },
        );
      }
      if (request.method === 'POST') {
        requireSameOrigin(request);
        return new Response(null, {
          status: 302,
          headers: {
            Location: decideConsent(workspace, new URLSearchParams(body)),
            'Cache-Control': 'no-store',
          },
        });
      }
    },
  },
  {
    pattern: /^\/oauth\/token$/,
    handle({ workspace, request, body }) {
      if (request.method !== 'POST') return;
      return Response.json(
        exchangeToken(
          workspace,
          new URLSearchParams(body),
          request.headers.get('authorization'),
        ),
        { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
      );
    },
  },
  {
    pattern: /^\/oauth\/revoke$/,
    handle({ workspace, request, url, body }) {
      if (request.method !== 'POST') return;
      revokeToken(
        workspace,
        new URLSearchParams(body).get('token') ?? url.searchParams.get('token'),
      );
      return new Response(null, {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      });
    },
  },
  {
    pattern: /^\/userinfo$/,
    handle({ workspace, request }) {
      if (request.method !== 'GET') return;
      const grant = authenticate(
        workspace,
        request.headers.get('authorization'),
        readUserInfo,
      );
      const user = workspace.data.users.find((u) => u.id === grant.userId)!;
      return json({
        sub: user.id,
        id: user.id,
        ...(allowsEmail(grant.scopes)
          ? { email: user.email, verified_email: true, email_verified: true }
          : {}),
        ...(allowsProfile(grant.scopes) ? { name: user.name } : {}),
      });
    },
  },
];

/**
 * Management endpoints for OAuth clients (create, update, and delete) and for
 * revoking a connection from the admin UI.
 */
export const oauthManagementRoutes: Route[] = [
  {
    pattern: /^\/__calendarpit\/clients(?:\/([^/]+))?$/,
    handle({ workspace, request, body }, [clientId]) {
      const method = request.method;
      const existing = clientId ? findClient(workspace, clientId) : undefined;
      if (method === 'POST' && !existing)
        return json(
          publicClient(createClient(workspace, parseJsonBody(body))),
          201,
        );
      if (method === 'PATCH' && existing)
        return json(
          publicClient(updateClient(workspace, existing, parseJsonBody(body))),
        );
      if (method === 'DELETE' && existing) {
        deleteClient(workspace, existing);
        return noContent();
      }
    },
  },
  {
    pattern: /^\/__calendarpit\/connections\/([^/]+)\/revoke$/,
    handle({ workspace, request }, [grantId]) {
      if (request.method !== 'POST') return;
      revokeGrant(workspace, grantId!);
      return noContent();
    },
  },
];
