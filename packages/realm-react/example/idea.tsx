////////////////////////////////////////////////////////////////////////////
//
// Copyright 2022 Realm Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
////////////////////////////////////////////////////////////////////////////

export default function App() {
  const { authenticatedUser } = useAuth();

  return (
    <RealmAppProvider
      id="app-id"
      config={
        {
          /* or you can specify a config */
        }
      }
    >
      {authenticatedUser ? (
        // This could maybe inherit the user from the app if user is not specified?
        <RealmProvider sync={{ user: authenticatedUser, partitionValue: authenticatedUser.id }}>
          <App />
        </RealmProvider>
      ) : (
        <LoginScreen />
      )}
    </RealmAppProvider>
  );
}

// See generic_network_transport.hpp for all values.
// Some of these seem a bit generic, would be nice to be more granular if possible
enum AuthError {
  AuthError, // e.g. wrong password for login
  BadRequest, // e.g. password length wrong when registering.
  AccountNameInUse, // account name in use when registering
  InvalidEmailPassword, // ? not sure when this gets hit
}

type AuthResult = {
  loading: boolean;
  success: boolean;
  error:
    | {
        type: AuthError;
        message: string;
      }
    | undefined;
};

// or this, which is a more accurate state machine, but not as nice to consume
// as you have to do like `loginResult.state === AuthResultState.Loading` rather
// than `loginResult.loading`

enum AuthResultState {
  Loading,
  Success,
  Error,
}

type AuthResult = {
  state: AuthResultState;
  error:
    | {
        type: AuthError;
        message: string;
      }
    | undefined;
};

function LoginScreen() {
  const { login, loginResult, register, registerResult, sendResetPasswordEmail, sendResetPasswordEmailResult } =
    useEmailPasswordAuth();

  // Or we could do it like this - allows for easy renaming, but the hook names are long...
  // I guess we could "namespace" them (`import { useLogin, useRegister } from '@realm/react/emailPasswordAuth'`?)
  const [login, loginResult] = useEmailPasswordAuthLogin();
  const [register, registerResult] = useEmailPasswordAuthRegister();
  const [sendResetPasswordEmail, sendResetPasswordEmailResult] = useEmailPasswordAuthSendResetPasswordEmail();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    login({ email, password });
  };

  // alternatively you can:
  const handleLoginAwait = async () => {
    console.log("Logging in...");
    try {
      const user = await login({ email, password });
      console.log("Logged in, user is", user);
    } catch (e) {
      console.error("Error logging in:", e.message);
    }
  };

  const handleRegister = () => {
    register({ email, password, loginAfterRegister: true });
  };

  const handleForgotPassword = () => {
    sendResetPasswordEmail({ email });
  };

  return (
    <View>
      <View>
        <Text>Email</Text>
        {registerResult.error && registerResult.error.type === AuthError.AccountNameInUse && (
          <Text>This account name is already in use</Text>
        )}
        <TextInput onTextChange={setEmail} />
      </View>

      <View>
        <Text>Password</Text>
        {registerResult.error && registerResult.error.type === AuthError.BadRequest && (
          <Text>Password error: {registerResult.error.message}</Text>
        )}
        <TextInput onTextChange={setPassword} />
      </View>

      {loginResult.error && <Text>Login error: {loginResult.error.message}</Text>}
      {sendResetPasswordEmailResult.success && <Text>A password reset email has been sent</Text>}

      {loginResult.loading || registerResult.loading || sendResetPasswordEmailResult.loading ? (
        <Text>Please wait...</Text>
      ) : (
        <>
          <Button title="Login" onClick={handleLogin} />
          <Button title="Forgot Password" onClick={handleForgotPassword} />
          <Button title="Register" onClick={handleRegister} />
        </>
      )}
    </View>
  );
}

function TokenLogin() {
  const { login, loginResult } = useAuth();
  // or...
  const { login, loginResult } = useAuth(AuthProvider.Google);
  // or...
  const { googleLogin } = useGoogleAuth();

  useEffect(() => {
    login(Realm.Credentials.google("asdfg"));
    // or...
    googleLogin("asdfg");
  });

  if (loginResult.loading) return <Text>Please wait...</Text>;
  else if (loginResult.error) return <Text>There was an error: {loginResult.error.message}</Text>;
  else return <Text>Login has not started yet</Text>;
}

function ResetPasswordScreen({ token, tokenId }) {
  const { resetPassword, resetPasswordResult } = useEmailPasswordAuth();

  const [password, setPassword] = useState("");

  const handleResetPassword = () => {
    resetPassword({ password, token, tokenId });
  };

  return (
    <View>
      <View>
        <Text>New password</Text>
        {resetPasswordResult.error && resetPasswordResult.error.type === AuthError.BadRequest && (
          <Text>Password error: {resetPasswordResult.error.message}</Text>
        )}
        <TextInput onTextChange={setPassword} />
      </View>

      {resetPasswordResult.loading ? (
        <Text>Please wait...</Text>
      ) : (
        <Button title="Reset Password" onClick={handleResetPassword} />
      )}
    </View>
  );
}

// If we can batch subscription updates automatically...
function SubscribedScreenIdeal() {
  const { addSubscription, addSubscriptionResult, removeSubscription } = useSyncSubscriptions();

  const cats = useQuery<Cat>("Cat");
  const dogs = useQuery<Dog>("Dog");

  useEffect(() => {
    // Somehow it knows to batch these into one update
    const catsSub = addSubscription(cats);
    addSubscription(dogs.filtered("age > 10"));

    return () => {
      removeSubscription(catsSub);
    };
  }, []);

  return addSubscriptionResult.loading ? (
    <Text>Please wait...</Text>
  ) : (
    <Text>
      {cats.length} cats and {dogs.length} dogs
    </Text>
  );
}

// If not...
function SubscribedScreenFallback() {
  const { updateSubscriptions, updateSubscriptionsResult } = useSyncSubscriptions();

  useEffect(() => {
    let catsSub;

    updateSubscriptions((mutableSubs) => {
      catsSub = mutableSubs.add(cats);
      mutableSubs.add(dogs.filtered("age > 10"));
    });

    return () => {
      updateSubscriptions((mutableSubs) => {
        mutableSubs.removeSubscription(catsSub);
      });
    };
  }, []);

  return updateSubscriptionResult.loading ? (
    <Text>Please wait...</Text>
  ) : (
    <Text>
      {cats.length} cats and {dogs.length} dogs
    </Text>
  );
}

// Hooks example

import { useRef } from "react";

export const useAddSubscription = () => {
  const updates = useRef([]);
  const waitingForFlush = useRef(false);

  const addSubscription = (query: Realm.Results) => {
    updates.current.push(query);

    if (!waitingForFlush) {
      waitingForFlush.current = true;
      setImmediate(flush);
    }
  };
};

// Partition example

function SubscribedScreenIdeal() {
  const { setPartitionValue, setPartitionValueResult } = useSyncSubscriptions();
}
