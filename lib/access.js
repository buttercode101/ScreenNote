import {scrypt,randomBytes,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
export async function passwordRecord(password){if(password===undefined||password==='')return{};if(typeof password!=='string'||password.length<8||password.length>128)throw Error('Use a sharing password of 8–128 characters.');const passwordSalt=randomBytes(16).toString('hex'),passwordHash=(await derive(password,passwordSalt,32)).toString('hex');return{passwordSalt,passwordHash}}
export async function checkPassword(c,password){if(!c.passwordHash)return true;if(typeof password!=='string'||password.length>128)return false;const computed=await derive(password,c.passwordSalt,32);return timingSafeEqual(computed,Buffer.from(c.passwordHash,'hex'))}
