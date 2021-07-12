import { Container, Typography, AppBar, Toolbar, makeStyles } from '@material-ui/core';
import TodoList from './components/TodoList';
import Profile from './components/profile'
import AuthButton from './components/authenticationButton'
import {useAuth0, withAuthenticationRequired } from '@auth0/auth0-react'
import Loading from './components/loading'

const useStyles = makeStyles(theme => ({
  main: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch'
  }
}));

function App() {

  const classes = useStyles();

  return (
    <>
      <AppBar position="fixed">
        <Toolbar>

          <div><Typography variant="h6">My Todos</Typography></div>
          <div style = {{marginLeft:'85%'}}>
          <AuthButton />
          </div>
        </Toolbar>
      </AppBar>
      <Container fixed>
        <Toolbar />
        <main className={classes.main}>
          <TodoList />
        </main>
        <Profile />
      </Container>
    </>
  );
}

export default withAuthenticationRequired(App,{
  onRedirecting: () => <Loading />
});