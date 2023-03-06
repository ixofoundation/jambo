import axios from 'axios';
import type { NextApiRequest, NextApiResponse } from 'next';

export type GetValidatorAvatarResponse = {
  url: string | null;
  error?: any;
};

const keybaseRequest = async (path: string) => {
  try {
    const response = await axios.get(`https://keybase.io/_/api/1.0${path}`);

    return Promise.resolve(response.data);
  } catch (error) {
    return Promise.reject(error);
  }
};

const getValidatorAvatar = async (req: NextApiRequest, res: NextApiResponse<GetValidatorAvatarResponse>) => {
  try {
    const { identity } = req.body;

    if (!identity?.length) {
      throw new Error('No identity provided to get validator avatar.');
    }

    const {
      keys: [{ key_fingerprint }],
    } = await keybaseRequest(`/key/fetch.json?pgp_key_ids=${identity}`);
    const {
      them: [
        {
          pictures: {
            primary: { url },
          },
        },
      ],
    } = await keybaseRequest(`/user/lookup.json?key_fingerprint=${key_fingerprint}`);

    res.status(200).json({ url });
  } catch (error) {
    res.status(500).json({ url: '', error });
  }
  res.end();
};

export default getValidatorAvatar;
