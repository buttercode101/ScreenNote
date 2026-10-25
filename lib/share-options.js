export function newShareIdentity(c,now=Date.now()){return!!(c.revoked||c.cloudDeleted||c.shared&&c.expiresAt<=now)}
export function shareOptions(c,linkDays,password=''){
 if(![1,3,7].includes(linkDays))throw Error('Choose an expiry of 1, 3 or 7 days.');
 if(typeof password!=='string'||password&& (password.length<8||password.length>128))throw Error('Use a sharing password of 8–128 characters.');
 if(c.passwordProtected&&!password)throw Error('Enter the sharing password before retrying or republishing this protected video. For a pending upload, use its original password.');
 return{linkDays,password,newIdentity:newShareIdentity(c)};
}
